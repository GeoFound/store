#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT_DIR/scripts/profile/env.sh"
BUYER_EMAIL="${BUYER_EMAIL:-buyer@example.com}"
order_id=""
smoke_log="$(mktemp)"
backend_pid=""
storefront_pid=""
admin_pid=""
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:9102}"
STOREFRONT_URL="${STOREFRONT_URL:-http://127.0.0.1:8100}"
ADMIN_APP_URL="${ADMIN_APP_URL:-http://127.0.0.1:8101}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$ROOT_DIR/apps/backend/.env}"
STOREFRONT_ENV_FILE="${STOREFRONT_ENV_FILE:-$ROOT_DIR/apps/storefront/.env.local}"
BACKEND_LOG="${BACKEND_LOG:-/tmp/store-backend-live-acceptance.log}"
STOREFRONT_LOG="${STOREFRONT_LOG:-/tmp/store-storefront-live-acceptance.log}"
ADMIN_LOG="${ADMIN_LOG:-/tmp/store-admin-live-acceptance.log}"
ADMIN_SMOKE_EMAIL="${ADMIN_SMOKE_EMAIL:-admin-smoke@example.com}"
ADMIN_SMOKE_PASSWORD="${ADMIN_SMOKE_PASSWORD:-Smoke-Admin-123!}"
MANUAL_WEBHOOK_SECRET="${MANUAL_WEBHOOK_SECRET:-store_live_smoke_webhook_secret}"
JWT_SECRET="${JWT_SECRET:-store_live_smoke_jwt_secret}"
COOKIE_SECRET="${COOKIE_SECRET:-store_live_smoke_cookie_secret}"
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-/tmp/store-live-acceptance-config}"

read_backend_env_value() {
  local key="$1"

  if [[ ! -f "$BACKEND_ENV_FILE" ]]; then
    return 0
  fi

  awk -F= -v target="$key" '$1 == target {print substr($0, index($0, "=") + 1)}' "$BACKEND_ENV_FILE" | tail -n 1
}

read_storefront_env_value() {
  local key="$1"

  if [[ ! -f "$STOREFRONT_ENV_FILE" ]]; then
    return 0
  fi

  awk -F= -v target="$key" '$1 == target {print substr($0, index($0, "=") + 1)}' "$STOREFRONT_ENV_FILE" | tail -n 1
}

assert_site_profile() {
  assert_site_profile_env_match "$SITE_ID" "$SITE_ENV" "$NEXT_PUBLIC_SITE_ID" "$NEXT_PUBLIC_SITE_ENV"
  validate_site_profile "$SITE_ID" "$SITE_ENV" "$SITE_PROFILES_ROOT"
}

is_valid_encryption_key() {
  local value="$1"

  if [[ -z "$value" ]] || [[ "$value" == "replace-with-"* ]]; then
    return 1
  fi

  KEY_VALUE="$value" node -e '
const raw = process.env.KEY_VALUE || "";
const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
if (key.length !== 32) process.exit(1);
' >/dev/null 2>&1
}

resolve_encryption_key() {
  local key_name="$1"
  local fallback_value="$2"
  local candidate="${!key_name:-}"

  if [[ -z "$candidate" ]]; then
    candidate="$(read_backend_env_value "$key_name")"
  fi

  if is_valid_encryption_key "$candidate"; then
    printf '%s' "$candidate"
    return 0
  fi

  printf '%s' "$fallback_value"
}

resolve_optional_env_value() {
  local key_name="$1"
  local candidate="${!key_name:-}"

  if [[ -z "$candidate" ]]; then
    candidate="$(read_backend_env_value "$key_name")"
  fi

  printf '%s' "$candidate"
}

DEFAULT_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
CREDENTIAL_ENCRYPTION_KEY="$(resolve_encryption_key CREDENTIAL_ENCRYPTION_KEY "$DEFAULT_ENCRYPTION_KEY")"
DELIVERY_ENCRYPTION_KEY="$(resolve_encryption_key DELIVERY_ENCRYPTION_KEY "$CREDENTIAL_ENCRYPTION_KEY")"
CREDENTIAL_ENCRYPTION_KEY_PREVIOUS="$(resolve_optional_env_value CREDENTIAL_ENCRYPTION_KEY_PREVIOUS)"
DELIVERY_ENCRYPTION_KEY_PREVIOUS="$(resolve_optional_env_value DELIVERY_ENCRYPTION_KEY_PREVIOUS)"
SITE_ID="${SITE_ID:-$(read_backend_env_value SITE_ID)}"
SITE_ID="${SITE_ID:-site-1}"
SITE_ENV="${SITE_ENV:-$(read_backend_env_value SITE_ENV)}"
SITE_ENV="${SITE_ENV:-development}"
NEXT_PUBLIC_SITE_ID="${NEXT_PUBLIC_SITE_ID:-$(read_storefront_env_value NEXT_PUBLIC_SITE_ID)}"
NEXT_PUBLIC_SITE_ID="${NEXT_PUBLIC_SITE_ID:-$SITE_ID}"
NEXT_PUBLIC_SITE_ENV="${NEXT_PUBLIC_SITE_ENV:-$(read_storefront_env_value NEXT_PUBLIC_SITE_ENV)}"
NEXT_PUBLIC_SITE_ENV="${NEXT_PUBLIC_SITE_ENV:-$SITE_ENV}"
SITE_PROFILES_ROOT="${SITE_PROFILES_ROOT:-$(read_storefront_env_value SITE_PROFILES_ROOT)}"
SITE_PROFILES_ROOT="${SITE_PROFILES_ROOT:-$(read_backend_env_value SITE_PROFILES_ROOT)}"
SITE_PROFILES_ROOT="$(resolve_site_profiles_root "$ROOT_DIR" "$SITE_PROFILES_ROOT")"

cleanup() {
  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
  fi

  if [[ -n "$storefront_pid" ]] && kill -0 "$storefront_pid" 2>/dev/null; then
    kill "$storefront_pid" 2>/dev/null || true
    wait "$storefront_pid" 2>/dev/null || true
  fi

  if [[ -n "$admin_pid" ]] && kill -0 "$admin_pid" 2>/dev/null; then
    kill "$admin_pid" 2>/dev/null || true
    wait "$admin_pid" 2>/dev/null || true
  fi

  BUYER_EMAIL="$BUYER_EMAIL" bash "$ROOT_DIR/scripts/cleanup-live-smoke-data.sh" >/dev/null 2>&1 || true
  rm -f "$smoke_log"
}

trap cleanup EXIT

wait_for_url() {
  local url="$1"
  local attempts="${2:-90}"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "Timed out waiting for $url" >&2
  return 1
}

url_port() {
  local url="$1"

  URL_VALUE="$url" node -e '
const parsed = new URL(process.env.URL_VALUE || "");
if (parsed.port) {
  process.stdout.write(parsed.port);
  process.exit(0);
}
process.stdout.write(parsed.protocol === "https:" ? "443" : "80");
'
}

BACKEND_PORT="${BACKEND_PORT:-$(url_port "$BACKEND_URL")}"
STOREFRONT_PORT="${STOREFRONT_PORT:-$(url_port "$STOREFRONT_URL")}"
ADMIN_APP_PORT="${ADMIN_APP_PORT:-$(url_port "$ADMIN_APP_URL")}"

wait_for_managed_url() {
  local url="$1"
  local pid="$2"
  local name="$3"
  local log_file="$4"
  local attempts="${5:-90}"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi

    if ! kill -0 "$pid" 2>/dev/null; then
      echo "$name process exited while waiting for $url" >&2
      if [[ -f "$log_file" ]]; then
        tail -n 80 "$log_file" >&2 || true
      fi
      return 1
    fi

    sleep 1
  done

  echo "Timed out waiting for $url" >&2
  echo "Last response from $url:" >&2
  curl -i --max-time 5 "$url" >&2 || true
  if [[ -f "$log_file" ]]; then
    echo "Last $name log lines:" >&2
    tail -n 120 "$log_file" >&2 || true
  fi
  return 1
}

rm -f "$BACKEND_LOG" "$STOREFRONT_LOG"
mkdir -p "$XDG_CONFIG_HOME"
assert_site_profile

echo "Starting shared backend..."
(
  cd "$ROOT_DIR"
  XDG_CONFIG_HOME="$XDG_CONFIG_HOME" \
  MANUAL_WEBHOOK_SECRET="$MANUAL_WEBHOOK_SECRET" \
  JWT_SECRET="$JWT_SECRET" \
  COOKIE_SECRET="$COOKIE_SECRET" \
  CREDENTIAL_ENCRYPTION_KEY="$CREDENTIAL_ENCRYPTION_KEY" \
  CREDENTIAL_ENCRYPTION_KEY_PREVIOUS="$CREDENTIAL_ENCRYPTION_KEY_PREVIOUS" \
  DELIVERY_ENCRYPTION_KEY="$DELIVERY_ENCRYPTION_KEY" \
  DELIVERY_ENCRYPTION_KEY_PREVIOUS="$DELIVERY_ENCRYPTION_KEY_PREVIOUS" \
  SITE_ID="$SITE_ID" \
  SITE_ENV="$SITE_ENV" \
  SITE_PROFILES_ROOT="$SITE_PROFILES_ROOT" \
  PORT="$BACKEND_PORT" \
    pnpm --dir apps/backend dev >"$BACKEND_LOG" 2>&1
) &
backend_pid="$!"

echo "Starting shared storefront..."
(
  cd "$ROOT_DIR"
  SITE_ID="$SITE_ID" \
  SITE_ENV="$SITE_ENV" \
  NEXT_PUBLIC_SITE_ID="$NEXT_PUBLIC_SITE_ID" \
  NEXT_PUBLIC_SITE_ENV="$NEXT_PUBLIC_SITE_ENV" \
  MEDUSA_BACKEND_URL="$BACKEND_URL" \
  NEXT_PUBLIC_MEDUSA_BACKEND_URL="$BACKEND_URL" \
  SITE_PROFILES_ROOT="$SITE_PROFILES_ROOT" \
    pnpm --dir apps/storefront exec next start --port "$STOREFRONT_PORT" --hostname 127.0.0.1 >"$STOREFRONT_LOG" 2>&1
) &
storefront_pid="$!"

wait_for_managed_url "$BACKEND_URL/health" "$backend_pid" "backend" "$BACKEND_LOG"
wait_for_managed_url "$STOREFRONT_URL/api/health" "$storefront_pid" "storefront" "$STOREFRONT_LOG"

echo "Running live order smoke..."
BUYER_EMAIL="$BUYER_EMAIL" \
MANAGE_SERVICES=0 \
BACKEND_URL="$BACKEND_URL" \
STOREFRONT_URL="$STOREFRONT_URL" \
MANUAL_WEBHOOK_SECRET="$MANUAL_WEBHOOK_SECRET" \
JWT_SECRET="$JWT_SECRET" \
COOKIE_SECRET="$COOKIE_SECRET" \
CREDENTIAL_ENCRYPTION_KEY="$CREDENTIAL_ENCRYPTION_KEY" \
CREDENTIAL_ENCRYPTION_KEY_PREVIOUS="$CREDENTIAL_ENCRYPTION_KEY_PREVIOUS" \
DELIVERY_ENCRYPTION_KEY="$DELIVERY_ENCRYPTION_KEY" \
DELIVERY_ENCRYPTION_KEY_PREVIOUS="$DELIVERY_ENCRYPTION_KEY_PREVIOUS" \
SITE_ID="$SITE_ID" \
SITE_ENV="$SITE_ENV" \
NEXT_PUBLIC_SITE_ID="$NEXT_PUBLIC_SITE_ID" \
NEXT_PUBLIC_SITE_ENV="$NEXT_PUBLIC_SITE_ENV" \
SITE_PROFILES_ROOT="$SITE_PROFILES_ROOT" \
  bash "$ROOT_DIR/scripts/live-order-smoke.sh" | tee "$smoke_log"

order_id="$(awk -F= '/^order_id=/{print $2}' "$smoke_log" | tail -n 1)"

if [[ -z "$order_id" ]]; then
  echo "Failed to extract order_id from live-order-smoke output" >&2
  exit 1
fi

echo "Running live recovery smoke..."
BUYER_EMAIL="$BUYER_EMAIL" \
ORDER_ID="$order_id" \
MANAGE_SERVICES=0 \
BACKEND_URL="$BACKEND_URL" \
STOREFRONT_URL="$STOREFRONT_URL" \
BACKEND_LOG="$BACKEND_LOG" \
STOREFRONT_LOG="$STOREFRONT_LOG" \
CREDENTIAL_ENCRYPTION_KEY="$CREDENTIAL_ENCRYPTION_KEY" \
CREDENTIAL_ENCRYPTION_KEY_PREVIOUS="$CREDENTIAL_ENCRYPTION_KEY_PREVIOUS" \
DELIVERY_ENCRYPTION_KEY="$DELIVERY_ENCRYPTION_KEY" \
DELIVERY_ENCRYPTION_KEY_PREVIOUS="$DELIVERY_ENCRYPTION_KEY_PREVIOUS" \
SITE_ID="$SITE_ID" \
SITE_ENV="$SITE_ENV" \
NEXT_PUBLIC_SITE_ID="$NEXT_PUBLIC_SITE_ID" \
NEXT_PUBLIC_SITE_ENV="$NEXT_PUBLIC_SITE_ENV" \
SITE_PROFILES_ROOT="$SITE_PROFILES_ROOT" \
bash "$ROOT_DIR/scripts/live-order-recovery-smoke.sh"

echo "Seeding admin smoke user..."
(
  cd "$ROOT_DIR"
  XDG_CONFIG_HOME="$XDG_CONFIG_HOME" \
  JWT_SECRET="$JWT_SECRET" \
  COOKIE_SECRET="$COOKIE_SECRET" \
  SITE_ID="$SITE_ID" \
  SITE_ENV="$SITE_ENV" \
  SITE_PROFILES_ROOT="$SITE_PROFILES_ROOT" \
    pnpm --dir apps/backend exec medusa user \
      -e "$ADMIN_SMOKE_EMAIL" -p "$ADMIN_SMOKE_PASSWORD"
) || echo "admin smoke user already exists (continuing)"

echo "Starting admin BFF app..."
(
  cd "$ROOT_DIR"
  ADMIN_MEDUSA_BACKEND_URL="$BACKEND_URL" \
  ADMIN_TRUSTED_ORIGINS="$ADMIN_APP_URL" \
    pnpm --dir apps/admin exec next start --port "$ADMIN_APP_PORT" --hostname 127.0.0.1 >"$ADMIN_LOG" 2>&1
) &
admin_pid="$!"

wait_for_managed_url "$ADMIN_APP_URL/api/health" "$admin_pid" "admin" "$ADMIN_LOG"

echo "Running admin BFF smoke..."
ADMIN_APP_URL="$ADMIN_APP_URL" \
ADMIN_SMOKE_EMAIL="$ADMIN_SMOKE_EMAIL" \
ADMIN_SMOKE_PASSWORD="$ADMIN_SMOKE_PASSWORD" \
  pnpm smoke:admin

echo "Live acceptance passed"
