#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/store}"
APP_USER="${APP_USER:-store}"
APP_GROUP="${APP_GROUP:-$APP_USER}"

usage() {
  cat <<USAGE
usage: sudo APP_ROOT=/opt/store APP_USER=store bash scripts/deploy/bootstrap-vps.sh

Creates deployment directories and production env placeholders.
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

if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash "$APP_USER"
fi

mkdir -p \
  "$APP_ROOT/releases" \
  "$APP_ROOT/shared" \
  "$APP_ROOT/shared/logs" \
  "$APP_ROOT/shared/backups" \
  "$APP_ROOT/shared/pnpm-store"

if [[ ! -f "$APP_ROOT/shared/backend.env" ]]; then
  cat > "$APP_ROOT/shared/backend.env" <<'BACKEND_ENV'
NODE_ENV=production
PORT=9002
SITE_ID=site-1
SITE_ENV=production
DATABASE_URL=postgres://store:replace-with-strong-postgres-password@127.0.0.1:5433/store
REDIS_URL=redis://:replace-with-strong-redis-password@127.0.0.1:6380
JWT_SECRET=replace-with-strong-random-jwt-secret
COOKIE_SECRET=replace-with-strong-random-cookie-secret
MANUAL_WEBHOOK_SECRET=replace-with-strong-random-webhook-secret
MANUAL_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS=300
ORDER_RECOVERY_MAX_FAILED_ATTEMPTS=5
ORDER_RECOVERY_BLOCK_SECONDS=600
CREDENTIAL_ENCRYPTION_KEY=replace-with-32-byte-base64-key
CREDENTIAL_ENCRYPTION_KEY_PREVIOUS=
DELIVERY_ENCRYPTION_KEY=replace-with-32-byte-base64-key
DELIVERY_ENCRYPTION_KEY_PREVIOUS=
RESEND_ENABLED=false
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_REPLY_TO_EMAIL=
RESEND_API_BASE_URL=https://api.resend.com
STORE_CORS=https://example.com
ADMIN_CORS=https://api.example.com
AUTH_CORS=https://example.com,https://api.example.com
SECURITY_ALLOWED_ORIGINS=
SECURITY_TRUST_PROXY_HEADERS=true
SECURITY_HEADERS_ENABLED=true
SECURITY_ENFORCE_ORIGIN_CHECKS=true
SECURITY_HSTS_MAX_AGE_SECONDS=31536000
SECURITY_HSTS_INCLUDE_SUBDOMAINS=true
SECURITY_HSTS_PRELOAD=false
SECURITY_RATE_LIMIT_MAX_KEYS=50000
BACKEND_ENV
fi

if [[ ! -f "$APP_ROOT/shared/services.env" ]]; then
  cat > "$APP_ROOT/shared/services.env" <<'SERVICES_ENV'
POSTGRES_PASSWORD=replace-with-strong-postgres-password
REDIS_PASSWORD=replace-with-strong-redis-password
POSTGRES_BIND_IP=127.0.0.1
POSTGRES_PORT=5433
REDIS_BIND_IP=127.0.0.1
REDIS_PORT=6380
SERVICES_ENV
fi

if [[ ! -f "$APP_ROOT/shared/storefront.env" ]]; then
  cat > "$APP_ROOT/shared/storefront.env" <<'STOREFRONT_ENV'
NODE_ENV=production
PORT=8000
HOSTNAME=127.0.0.1
SITE_ID=site-1
SITE_ENV=production
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.example.com
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=replace-with-medusa-publishable-key
NEXT_PUBLIC_MEDUSA_REGION_ID=
NEXT_PUBLIC_ALLOWED_IMAGE_HOSTS=
NEXT_PUBLIC_SITE_ID=site-1
NEXT_PUBLIC_SITE_ENV=production
NEXT_PUBLIC_PRIVACY_BANNER_ENABLED=true
NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT=true
STOREFRONT_ENV
fi

chown -R "$APP_USER:$APP_GROUP" "$APP_ROOT"
chmod 750 "$APP_ROOT" "$APP_ROOT/shared"
chmod 640 "$APP_ROOT/shared/backend.env" "$APP_ROOT/shared/storefront.env" "$APP_ROOT/shared/services.env"

echo "bootstrap-vps: ok"
echo "APP_ROOT=$APP_ROOT"
echo "APP_USER=$APP_USER"
echo "Next: fill $APP_ROOT/shared/backend.env, $APP_ROOT/shared/storefront.env, and $APP_ROOT/shared/services.env with real values"
