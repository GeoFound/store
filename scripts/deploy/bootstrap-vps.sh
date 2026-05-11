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
DATABASE_URL=postgres://store:replace-with-strong-password@127.0.0.1:5433/store
REDIS_URL=redis://127.0.0.1:6380
JWT_SECRET=replace-with-strong-random-jwt-secret
COOKIE_SECRET=replace-with-strong-random-cookie-secret
MANUAL_WEBHOOK_SECRET=replace-with-strong-random-webhook-secret
MANUAL_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS=300
ORDER_RECOVERY_MAX_FAILED_ATTEMPTS=5
ORDER_RECOVERY_BLOCK_SECONDS=600
CREDENTIAL_ENCRYPTION_KEY=replace-with-32-byte-base64-key
DELIVERY_ENCRYPTION_KEY=replace-with-32-byte-base64-key
STORE_CORS=https://example.com
ADMIN_CORS=https://api.example.com
AUTH_CORS=https://example.com,https://api.example.com
BACKEND_ENV
fi

if [[ ! -f "$APP_ROOT/shared/storefront.env" ]]; then
  cat > "$APP_ROOT/shared/storefront.env" <<'STOREFRONT_ENV'
NODE_ENV=production
PORT=8000
HOSTNAME=127.0.0.1
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.example.com
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=replace-with-medusa-publishable-key
NEXT_PUBLIC_MEDUSA_REGION_ID=
STOREFRONT_ENV
fi

chown -R "$APP_USER:$APP_GROUP" "$APP_ROOT"
chmod 750 "$APP_ROOT" "$APP_ROOT/shared"
chmod 640 "$APP_ROOT/shared/backend.env" "$APP_ROOT/shared/storefront.env"

echo "bootstrap-vps: ok"
echo "APP_ROOT=$APP_ROOT"
echo "APP_USER=$APP_USER"
echo "Next: fill $APP_ROOT/shared/backend.env and $APP_ROOT/shared/storefront.env with real values"
