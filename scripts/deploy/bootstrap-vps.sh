#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

APP_ROOT="${APP_ROOT:-/opt/store}"
APP_USER="${APP_USER:-store}"
APP_GROUP="${APP_GROUP:-$APP_USER}"
NODE_MAJOR="${NODE_MAJOR:-26}"
PNPM_VERSION="${PNPM_VERSION:-10.32.1}"
INSTALL_SYSTEM_DEPS="${INSTALL_SYSTEM_DEPS:-1}"
INSTALL_NODE="${INSTALL_NODE:-1}"
INSTALL_DOCKER="${INSTALL_DOCKER:-1}"
INSTALL_CADDY="${INSTALL_CADDY:-1}"
INSTALL_SYSTEMD_UNITS="${INSTALL_SYSTEMD_UNITS:-1}"
START_INFRA="${START_INFRA:-1}"
CONFIGURE_CADDY="${CONFIGURE_CADDY:-1}"
APP_USER_DOCKER_ACCESS="${APP_USER_DOCKER_ACCESS:-0}"
STOREFRONT_DOMAIN="${STOREFRONT_DOMAIN:-example.com}"
API_DOMAIN="${API_DOMAIN:-api.example.com}"
CADDY_ADMIN_EMAIL="${CADDY_ADMIN_EMAIL:-ops@$STOREFRONT_DOMAIN}"
POSTGRES_BIND_IP="${POSTGRES_BIND_IP:-127.0.0.1}"
POSTGRES_PORT="${POSTGRES_PORT:-5433}"
REDIS_BIND_IP="${REDIS_BIND_IP:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6380}"

usage() {
  cat <<USAGE
usage: sudo APP_ROOT=/opt/store APP_USER=store STOREFRONT_DOMAIN=example.com API_DOMAIN=api.example.com bash scripts/deploy/bootstrap-vps.sh

Installs the production VPS runtime, creates deployment directories, generates
initial production secrets, installs systemd units, optionally configures Caddy,
and starts PostgreSQL/Redis.

Environment:
  APP_ROOT                 Deployment root (default: /opt/store)
  APP_USER                 Runtime user (default: store)
  NODE_MAJOR               Node.js major from NodeSource (default: 26)
  PNPM_VERSION             pnpm version to activate (default: 10.32.1)
  STOREFRONT_DOMAIN        Public storefront host (default: example.com)
  API_DOMAIN               Public API/Admin host (default: api.example.com)
  CADDY_ADMIN_EMAIL        ACME contact email (default: ops@STOREFRONT_DOMAIN)
  INSTALL_SYSTEM_DEPS      Install apt base packages (default: 1)
  INSTALL_NODE             Install Node.js and pnpm (default: 1)
  INSTALL_DOCKER           Install Docker Engine and Compose plugin (default: 1)
  INSTALL_CADDY            Install Caddy (default: 1)
  INSTALL_SYSTEMD_UNITS    Install backend/storefront units (default: 1)
  START_INFRA              Start PostgreSQL/Redis containers (default: 1)
  CONFIGURE_CADDY          Write /etc/caddy/Caddyfile when real domains are set (default: 1)
  APP_USER_DOCKER_ACCESS   Add APP_USER to docker group (default: 0; avoid for least privilege)
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "$EUID" -ne 0 ]]; then
  echo "bootstrap-vps.sh must run as root" >&2
  exit 2
fi

is_truthy() {
  local value="${1:-}"
  local normalized
  normalized="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  [[ "$normalized" == "1" || "$normalized" == "true" || "$normalized" == "yes" || "$normalized" == "on" ]]
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command after bootstrap step: $cmd" >&2
    exit 2
  fi
}

apt_install() {
  DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
}

random_secret() {
  openssl rand -hex 32
}

random_key() {
  openssl rand -base64 32
}

to_origin() {
  local value="$1"
  if [[ "$value" == http://* || "$value" == https://* ]]; then
    printf '%s' "$value"
    return 0
  fi

  printf 'https://%s' "$value"
}

install_system_deps() {
  if ! is_truthy "$INSTALL_SYSTEM_DEPS"; then
    return 0
  fi

  apt-get update
  apt_install \
    ca-certificates \
    curl \
    debian-archive-keyring \
    debian-keyring \
    gnupg \
    jq \
    openssl \
    git \
    tar \
    util-linux \
    lsb-release \
    apt-transport-https
}

install_node_runtime() {
  if ! is_truthy "$INSTALL_NODE"; then
    return 0
  fi

  local current_major=""
  if command -v node >/dev/null 2>&1; then
    current_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
  fi

  if [[ "$current_major" != "$NODE_MAJOR" ]]; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt_install nodejs
  fi

  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare "pnpm@$PNPM_VERSION" --activate
  else
    npm install -g "pnpm@$PNPM_VERSION"
  fi

  require_cmd node
  require_cmd pnpm
}

install_docker_runtime() {
  if ! is_truthy "$INSTALL_DOCKER"; then
    return 0
  fi

  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    systemctl enable --now docker
    return 0
  fi

  local codename="${VERSION_CODENAME:-}"
  if [[ -z "$codename" && -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    source /etc/os-release
    codename="${VERSION_CODENAME:-${UBUNTU_CODENAME:-}}"
  fi

  if [[ -z "$codename" ]]; then
    echo "Unable to determine Ubuntu codename for Docker repository setup" >&2
    exit 2
  fi

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu %s stable\n' \
    "$(dpkg --print-architecture)" \
    "$codename" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update
  apt_install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
}

install_caddy_runtime() {
  if ! is_truthy "$INSTALL_CADDY"; then
    return 0
  fi

  if ! command -v caddy >/dev/null 2>&1; then
    curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
      | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
      -o /etc/apt/sources.list.d/caddy-stable.list
    apt-get update
    apt_install caddy
  fi

  systemctl enable caddy
}

configure_caddy() {
  if ! is_truthy "$CONFIGURE_CADDY"; then
    return 0
  fi

  if [[ "$STOREFRONT_DOMAIN" == "example.com" || "$API_DOMAIN" == "api.example.com" ]]; then
    echo "Skipping Caddyfile write because STOREFRONT_DOMAIN/API_DOMAIN still use example domains"
    return 0
  fi

  install -d -m 0755 /etc/caddy
  cat > /etc/caddy/Caddyfile <<CADDY
{
  email $CADDY_ADMIN_EMAIL
  admin off
}

$STOREFRONT_DOMAIN {
  encode zstd gzip

  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
    Permissions-Policy "camera=(), microphone=(), geolocation=()"
  }

  reverse_proxy 127.0.0.1:8000
}

$API_DOMAIN {
  encode zstd gzip

  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
    Permissions-Policy "camera=(), microphone=(), geolocation=()"
  }

  reverse_proxy 127.0.0.1:9002
}
CADDY

  caddy validate --config /etc/caddy/Caddyfile
  systemctl enable --now caddy
  systemctl reload caddy || systemctl restart caddy
}

install_system_deps
install_node_runtime

if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash "$APP_USER"
fi

install_docker_runtime
install_caddy_runtime

if is_truthy "$APP_USER_DOCKER_ACCESS" && getent group docker >/dev/null 2>&1; then
  usermod -aG docker "$APP_USER"
fi

mkdir -p \
  "$APP_ROOT/releases" \
  "$APP_ROOT/shared" \
  "$APP_ROOT/shared/logs" \
  "$APP_ROOT/shared/backups" \
  "$APP_ROOT/shared/pnpm-store"

POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(random_secret)}"
REDIS_PASSWORD="${REDIS_PASSWORD:-$(random_secret)}"
JWT_SECRET="${JWT_SECRET:-$(random_secret)}"
COOKIE_SECRET="${COOKIE_SECRET:-$(random_secret)}"
MANUAL_WEBHOOK_SECRET="${MANUAL_WEBHOOK_SECRET:-$(random_secret)}"
CREDENTIAL_ENCRYPTION_KEY="${CREDENTIAL_ENCRYPTION_KEY:-$(random_key)}"
DELIVERY_ENCRYPTION_KEY="${DELIVERY_ENCRYPTION_KEY:-$(random_key)}"
SUPPLIER_ENCRYPTION_KEY="${SUPPLIER_ENCRYPTION_KEY:-$(random_key)}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-$(random_key)}"
STOREFRONT_ORIGIN="$(to_origin "$STOREFRONT_DOMAIN")"
API_ORIGIN="$(to_origin "$API_DOMAIN")"

if [[ ! -f "$APP_ROOT/shared/backend.env" ]]; then
  cat > "$APP_ROOT/shared/backend.env" <<BACKEND_ENV
NODE_ENV=production
PORT=9002
SITE_ID=site-1
SITE_ENV=production
TENANCY_MODE=dedicated
TENANT_ALLOWED_HOSTS=$STOREFRONT_DOMAIN,$API_DOMAIN
TENANT_FAIL_ON_HOST_MISMATCH=true
TENANT_SHARED_DATA_PLANE_READY=false
PLATFORM_ENABLED_PLUGINS=
PLATFORM_DISABLED_PLUGINS=
PLATFORM_ENABLED_CONTRACTS=
PLATFORM_DISABLED_CONTRACTS=
ORDER_ACCESS_PROVIDER_CODE=guest-order-access

DATABASE_URL=postgres://store:$POSTGRES_PASSWORD@127.0.0.1:$POSTGRES_PORT/store
REDIS_URL=redis://:$REDIS_PASSWORD@127.0.0.1:$REDIS_PORT

JWT_SECRET=$JWT_SECRET
COOKIE_SECRET=$COOKIE_SECRET
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=$STOREFRONT_ORIGIN/api/account/google/callback
CUSTOMER_ACCOUNT_MODE=guest_optional
CUSTOMER_PASSWORD_RESET_ENABLED=true
CUSTOMER_PASSWORD_RESET_URL=$STOREFRONT_ORIGIN/account/reset-password
CUSTOMER_EMAIL_VERIFICATION_STRATEGY=recovery_only

MANUAL_WEBHOOK_SECRET=$MANUAL_WEBHOOK_SECRET
MANUAL_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS=300
PLISIO_API_KEY=
PLISIO_API_BASE_URL=https://api.plisio.net/api/v1
PLISIO_CALLBACK_BASE_URL=$API_ORIGIN
PLISIO_SUCCESS_URL=$STOREFRONT_ORIGIN/checkout?payment=success
PLISIO_FAIL_URL=$STOREFRONT_ORIGIN/checkout?payment=failed
PLISIO_DEFAULT_CRYPTO_CURRENCY=
PLISIO_ALLOWED_PSYS_CIDS=
PLISIO_EXPIRE_MINUTES=60
CHECKOUT_OUT_OF_STOCK_POLICY=allow_supplier_backorder

ORDER_RECOVERY_MAX_FAILED_ATTEMPTS=5
ORDER_RECOVERY_BLOCK_SECONDS=600
ORDER_RECOVERY_REQUEST_COOLDOWN_SECONDS=60
SUPPLIER_PROCUREMENT_RETRY_BATCH_SIZE=25
SUPPLIER_AUTO_PROCUREMENT_ENABLED=false

CREDENTIAL_ENCRYPTION_KEY=$CREDENTIAL_ENCRYPTION_KEY
CREDENTIAL_ENCRYPTION_KEY_PREVIOUS=
DELIVERY_ENCRYPTION_KEY=$DELIVERY_ENCRYPTION_KEY
DELIVERY_ENCRYPTION_KEY_PREVIOUS=
SUPPLIER_ENCRYPTION_KEY=$SUPPLIER_ENCRYPTION_KEY
SUPPLIER_ENCRYPTION_KEY_PREVIOUS=

RELOADLY_ENV=production
RELOADLY_CLIENT_ID=
RELOADLY_CLIENT_SECRET=
RELOADLY_AUTH_URL=https://auth.reloadly.com/oauth/token
RELOADLY_AUDIENCE=
RELOADLY_API_BASE_URL=
RELOADLY_GIFTCARDS_BASE_URL=
RELOADLY_AIRTIME_BASE_URL=
RELOADLY_SENDER_NAME=Store

G2A_API_BASE_URL=https://api.g2a.com
G2A_ACCESS_TOKEN=
G2A_API_TOKEN=
G2A_API_KEY=

RESEND_ENABLED=false
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_REPLY_TO_EMAIL=
RESEND_API_BASE_URL=https://api.resend.com

STORE_CORS=$STOREFRONT_ORIGIN
ADMIN_CORS=$API_ORIGIN
AUTH_CORS=$STOREFRONT_ORIGIN,$API_ORIGIN
SECURITY_ALLOWED_ORIGINS=
SECURITY_TRUST_PROXY_HEADERS=true
SECURITY_HEADERS_ENABLED=true
SECURITY_ENFORCE_ORIGIN_CHECKS=true
SECURITY_RATE_LIMIT_STORE=redis
SECURITY_RATE_LIMIT_REDIS_URL=
SECURITY_RATE_LIMIT_REDIS_PREFIX=store:security:rate-limit:
SECURITY_RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS=1000
SECURITY_RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS=1000
SECURITY_HSTS_MAX_AGE_SECONDS=31536000
SECURITY_HSTS_INCLUDE_SUBDOMAINS=true
SECURITY_HSTS_PRELOAD=false
SECURITY_RATE_LIMIT_MAX_KEYS=50000
SECURITY_LIMIT_RECOVER_REQUEST_MAX_REQUESTS=6
SECURITY_LIMIT_RECOVER_REQUEST_WINDOW_SECONDS=600
SECURITY_LIMIT_RECOVER_REQUEST_BLOCK_SECONDS=900
SECURITY_LIMIT_RECOVER_VERIFY_MAX_REQUESTS=20
SECURITY_LIMIT_RECOVER_VERIFY_WINDOW_SECONDS=600
SECURITY_LIMIT_RECOVER_VERIFY_BLOCK_SECONDS=900
SECURITY_LIMIT_CLAIM_ORDER_ACCESS_MAX_REQUESTS=40
SECURITY_LIMIT_CLAIM_ORDER_ACCESS_WINDOW_SECONDS=600
SECURITY_LIMIT_CLAIM_ORDER_ACCESS_BLOCK_SECONDS=600
SECURITY_LIMIT_CREATE_CART_PAYMENT_MAX_REQUESTS=30
SECURITY_LIMIT_CREATE_CART_PAYMENT_WINDOW_SECONDS=300
SECURITY_LIMIT_CREATE_CART_PAYMENT_BLOCK_SECONDS=600
SECURITY_LIMIT_PAYMENT_WEBHOOK_MAX_REQUESTS=180
SECURITY_LIMIT_PAYMENT_WEBHOOK_WINDOW_SECONDS=60
SECURITY_LIMIT_PAYMENT_WEBHOOK_BLOCK_SECONDS=120
SECURITY_LIMIT_ADMIN_MUTATION_MAX_REQUESTS=120
SECURITY_LIMIT_ADMIN_MUTATION_WINDOW_SECONDS=60
SECURITY_LIMIT_ADMIN_MUTATION_BLOCK_SECONDS=120

EXPECT_CLOUDFLARE=${EXPECT_CLOUDFLARE:-false}
REQUIRE_CLOUDFLARE_SSL_MODE=strict
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_WAF_MANAGED_RULES_ENABLED=false
CLOUDFLARE_ACCESS_ADMIN_ENABLED=false

STOREFRONT_PUBLIC_URL=$STOREFRONT_ORIGIN
API_PUBLIC_URL=$API_ORIGIN
OPS_APP_ROOT=$APP_ROOT
OPS_BACKUP_DIR=$APP_ROOT/shared/backups
OPS_BACKUP_ENCRYPTION_ENABLED=false
OPS_BACKUP_OFFSITE_ENABLED=false
OPS_BACKUP_LAST_RESTORE_TEST_AT=
OPS_AUDIT_RETENTION_ENABLED=true
OPS_VPS_DOCTOR_ENABLED=false
OPS_APP_USER_LEAST_PRIVILEGE=true
OPS_VPS_DOCTOR_LAST_REPORT_PATH=$APP_ROOT/shared/logs/vps-doctor-latest.json
OPS_SSH_ROOT_LOGIN_DISABLED=false
OPS_SSH_PASSWORD_AUTH_DISABLED=false
OPS_UFW_ENABLED=false
OPS_UNATTENDED_UPGRADES_ENABLED=false
OPS_DOCKER_SOCKET_EXPOSED=false
OPS_SYSTEMD_HARDENING_LEVEL=hardened
OPS_AI_REVIEW_ENABLED=false
OPS_AI_AUTO_REMEDIATE_ENABLED=false

AUDIT_LOG_RETENTION_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=365
AUDIT_LOG_RETENTION_MIN_DAYS=90
AUDIT_LOG_RETENTION_PRUNE_BATCH_SIZE=1000
BACKEND_ENV
fi

if [[ ! -f "$APP_ROOT/shared/services.env" ]]; then
  cat > "$APP_ROOT/shared/services.env" <<SERVICES_ENV
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD
POSTGRES_BIND_IP=$POSTGRES_BIND_IP
POSTGRES_PORT=$POSTGRES_PORT
REDIS_BIND_IP=$REDIS_BIND_IP
REDIS_PORT=$REDIS_PORT
SERVICES_ENV
fi

if [[ ! -f "$APP_ROOT/shared/ops.env" ]]; then
  cat > "$APP_ROOT/shared/ops.env" <<OPS_ENV
BACKUP_DIR=$APP_ROOT/shared/backups
BACKUP_ENCRYPTION_REQUIRED=1
BACKUP_ENCRYPTION_KEY=$BACKUP_ENCRYPTION_KEY
OPS_ENV
fi

if [[ ! -f "$APP_ROOT/shared/storefront.env" ]]; then
  cat > "$APP_ROOT/shared/storefront.env" <<STOREFRONT_ENV
NODE_ENV=production
PORT=8000
HOSTNAME=127.0.0.1
SITE_ID=site-1
SITE_ENV=production
SITE_PROFILES_ROOT=../../profiles/sites
MEDUSA_BACKEND_URL=$API_ORIGIN
NEXT_PUBLIC_MEDUSA_BACKEND_URL=$API_ORIGIN
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY:-replace-with-medusa-publishable-key}
NEXT_PUBLIC_MEDUSA_REGION_ID=
NEXT_PUBLIC_ALLOWED_IMAGE_HOSTS=
NEXT_PUBLIC_COMMERCE_BACKEND=medusa
NEXT_PUBLIC_SITE_ID=site-1
NEXT_PUBLIC_SITE_ENV=production
NEXT_PUBLIC_SHOW_PLATFORM_DEMO_EXTENSIONS=false
NEXT_PUBLIC_PRIVACY_BANNER_ENABLED=true
NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT=true
ACCOUNT_AUTH_RATE_LIMIT_MAX_REQUESTS=20
ACCOUNT_AUTH_RATE_LIMIT_WINDOW_SECONDS=600
ACCOUNT_AUTH_RATE_LIMIT_BLOCK_SECONDS=900
ACCOUNT_AUTH_RATE_LIMIT_MAX_KEYS=10000
ACCOUNT_AUTH_TURNSTILE_ENABLED=false
NEXT_PUBLIC_ACCOUNT_AUTH_TURNSTILE_ENABLED=false
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
CUSTOMER_ACCOUNT_MODE=guest_optional
CUSTOMER_PASSWORD_RESET_ENABLED=true
CUSTOMER_PASSWORD_RESET_URL=$STOREFRONT_ORIGIN/account/reset-password
CUSTOMER_EMAIL_VERIFICATION_STRATEGY=recovery_only
STOREFRONT_ENV
fi

chown -R "$APP_USER:$APP_GROUP" "$APP_ROOT"
chmod 750 "$APP_ROOT" "$APP_ROOT/shared"
chmod 640 "$APP_ROOT/shared/backend.env" "$APP_ROOT/shared/storefront.env" "$APP_ROOT/shared/services.env"
chown root:root "$APP_ROOT/shared/ops.env"
chmod 600 "$APP_ROOT/shared/ops.env"

if is_truthy "$INSTALL_SYSTEMD_UNITS"; then
  APP_ROOT="$APP_ROOT" APP_USER="$APP_USER" APP_GROUP="$APP_GROUP" START_NOW=0 bash "$SCRIPT_DIR/install-systemd.sh"
fi

configure_caddy

if is_truthy "$START_INFRA"; then
  APP_ROOT="$APP_ROOT" bash "$SCRIPT_DIR/services-up.sh"
fi

echo "bootstrap-vps: ok"
echo "APP_ROOT=$APP_ROOT"
echo "APP_USER=$APP_USER"
echo "Runtime installed: node=$(node --version 2>/dev/null || true), pnpm=$(pnpm --version 2>/dev/null || true)"
echo "Next: fill domain/provider values that cannot be generated automatically, then run scripts/deploy/deploy.sh"
