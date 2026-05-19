#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT_DIR/scripts/profile/env.sh"
BACKEND_URL="${BACKEND_URL:-http://localhost:9002}"
STOREFRONT_URL="${STOREFRONT_URL:-http://localhost:8000}"
BUYER_EMAIL="${BUYER_EMAIL:-buyer@example.com}"
ORDER_ID="${ORDER_ID:-}"
BACKEND_LOG="${BACKEND_LOG:-/tmp/store-backend-recovery-smoke.log}"
STOREFRONT_LOG="${STOREFRONT_LOG:-/tmp/store-storefront-recovery-smoke.log}"
MANAGE_SERVICES="${MANAGE_SERVICES:-1}"
REQUIRE_STOREFRONT_HEALTH="${REQUIRE_STOREFRONT_HEALTH:-0}"
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-/tmp/store-smoke-config}"
SMOKE_HOME="${SMOKE_HOME:-/tmp/store-smoke-home}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-store-postgres}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$ROOT_DIR/apps/backend/.env}"
STOREFRONT_ENV_FILE="${STOREFRONT_ENV_FILE:-$ROOT_DIR/apps/storefront/.env.local}"
JWT_SECRET="${JWT_SECRET:-store_live_smoke_jwt_secret}"
COOKIE_SECRET="${COOKIE_SECRET:-store_live_smoke_cookie_secret}"
MANUAL_WEBHOOK_SECRET="${MANUAL_WEBHOOK_SECRET:-store_live_smoke_webhook_secret}"

read_backend_env_value() {
  local key="$1"

  if [[ ! -f "$BACKEND_ENV_FILE" ]]; then
    return 0
  fi

  awk -F= -v target="$key" '$1 == target {print substr($0, index($0, "=") + 1)}' "$BACKEND_ENV_FILE" | tail -n 1
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
REQUESTED_SITE_ID="${SITE_ID:-}"
REQUESTED_SITE_ENV="${SITE_ENV:-}"
REQUESTED_NEXT_PUBLIC_SITE_ID="${NEXT_PUBLIC_SITE_ID:-}"
REQUESTED_NEXT_PUBLIC_SITE_ENV="${NEXT_PUBLIC_SITE_ENV:-}"
REQUESTED_SITE_PROFILES_ROOT="${SITE_PROFILES_ROOT:-}"
BACKEND_SITE_ID="${REQUESTED_SITE_ID:-$(read_backend_env_value SITE_ID)}"
BACKEND_SITE_ENV="${REQUESTED_SITE_ENV:-$(read_backend_env_value SITE_ENV)}"

if [[ -z "$ORDER_ID" ]]; then
  echo "ORDER_ID is required" >&2
  exit 1
fi

mkdir -p "$XDG_CONFIG_HOME"
mkdir -p "$SMOKE_HOME"

if [[ -f "$STOREFRONT_ENV_FILE" ]]; then
  set -a
  source "$STOREFRONT_ENV_FILE"
  set +a
fi

SITE_ID="${BACKEND_SITE_ID:-${SITE_ID:-site-1}}"
SITE_ENV="${BACKEND_SITE_ENV:-${SITE_ENV:-development}}"
NEXT_PUBLIC_SITE_ID="${REQUESTED_NEXT_PUBLIC_SITE_ID:-${NEXT_PUBLIC_SITE_ID:-$SITE_ID}}"
NEXT_PUBLIC_SITE_ENV="${REQUESTED_NEXT_PUBLIC_SITE_ENV:-${NEXT_PUBLIC_SITE_ENV:-$SITE_ENV}}"
SITE_PROFILES_ROOT="${REQUESTED_SITE_PROFILES_ROOT:-${SITE_PROFILES_ROOT:-$(read_backend_env_value SITE_PROFILES_ROOT)}}"
SITE_PROFILES_ROOT="$(resolve_site_profiles_root "$ROOT_DIR" "$SITE_PROFILES_ROOT")"
PUBLISHABLE_KEY="${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY:-}"

if [[ -z "$PUBLISHABLE_KEY" ]]; then
  echo "Missing NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY" >&2
  exit 1
fi

backend_pid=""
storefront_pid=""

cleanup() {
  if [[ "$MANAGE_SERVICES" != "1" ]]; then
    return
  fi

  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
  fi

  if [[ -n "$storefront_pid" ]] && kill -0 "$storefront_pid" 2>/dev/null; then
    kill "$storefront_pid" 2>/dev/null || true
    wait "$storefront_pid" 2>/dev/null || true
  fi
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

json_get() {
  local json="$1"
  local query="$2"
  printf '%s' "$json" | jq -er "$query"
}

api_get() {
  local path="$1"
  curl -fsS \
    -H "x-publishable-api-key: $PUBLISHABLE_KEY" \
    "$BACKEND_URL$path"
}

api_post() {
  local path="$1"
  local body="$2"
  curl -fsS \
    -H "Content-Type: application/json" \
    -H "x-publishable-api-key: $PUBLISHABLE_KEY" \
    -X POST \
    -d "$body" \
    "$BACKEND_URL$path"
}

if [[ "$MANAGE_SERVICES" == "1" ]]; then
  assert_site_profile
  rm -f "$BACKEND_LOG" "$STOREFRONT_LOG"

  echo "Starting backend..."
  (
    cd "$ROOT_DIR"
    HOME="$SMOKE_HOME" \
    XDG_CONFIG_HOME="$XDG_CONFIG_HOME" \
    JWT_SECRET="$JWT_SECRET" \
    COOKIE_SECRET="$COOKIE_SECRET" \
    MANUAL_WEBHOOK_SECRET="$MANUAL_WEBHOOK_SECRET" \
    CREDENTIAL_ENCRYPTION_KEY="$CREDENTIAL_ENCRYPTION_KEY" \
    CREDENTIAL_ENCRYPTION_KEY_PREVIOUS="$CREDENTIAL_ENCRYPTION_KEY_PREVIOUS" \
    DELIVERY_ENCRYPTION_KEY="$DELIVERY_ENCRYPTION_KEY" \
    DELIVERY_ENCRYPTION_KEY_PREVIOUS="$DELIVERY_ENCRYPTION_KEY_PREVIOUS" \
    SITE_ID="$SITE_ID" \
    SITE_ENV="$SITE_ENV" \
    SITE_PROFILES_ROOT="$SITE_PROFILES_ROOT" \
    pnpm --dir apps/backend dev >"$BACKEND_LOG" 2>&1
  ) &
  backend_pid="$!"

  if [[ "$REQUIRE_STOREFRONT_HEALTH" == "1" ]]; then
    echo "Starting storefront..."
    (
      cd "$ROOT_DIR"
      SITE_ID="$SITE_ID" \
      SITE_ENV="$SITE_ENV" \
      NEXT_PUBLIC_SITE_ID="$NEXT_PUBLIC_SITE_ID" \
      NEXT_PUBLIC_SITE_ENV="$NEXT_PUBLIC_SITE_ENV" \
      SITE_PROFILES_ROOT="$SITE_PROFILES_ROOT" \
        pnpm --dir apps/storefront exec next dev --port 8000 --hostname 127.0.0.1 >"$STOREFRONT_LOG" 2>&1
    ) &
    storefront_pid="$!"
  fi
fi

wait_for_url "$BACKEND_URL/health"

if [[ "$REQUIRE_STOREFRONT_HEALTH" == "1" ]]; then
  wait_for_url "$STOREFRONT_URL/api/health"
fi

echo "Requesting recovery code..."
api_post "/store/orders/recover" "{\"email\":\"$BUYER_EMAIL\",\"order_id\":\"$ORDER_ID\"}" >/dev/null

recovery_code=""
for _ in $(seq 1 30); do
  recovery_code="$(
    docker exec "$POSTGRES_CONTAINER" \
      psql -U store -d store -tAc \
      "select data->>'code' from notification where template = 'guest-order-recovery' and data->>'order_id' = '$ORDER_ID' order by created_at desc limit 1;"
  )"
  recovery_code="$(printf '%s' "$recovery_code" | tr -d '[:space:]')"
  if [[ -n "$recovery_code" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$recovery_code" ]]; then
  echo "Recovery code was not found in notification records" >&2
  exit 1
fi

echo "Verifying recovery code..."
verify_json="$(api_post "/store/orders/recover/verify" "{\"order_id\":\"$ORDER_ID\",\"code\":\"$recovery_code\"}")"
access_token="$(json_get "$verify_json" '.access_token')"
verified_order_id="$(json_get "$verify_json" '.order_id')"

if [[ "$verified_order_id" != "$ORDER_ID" ]]; then
  echo "Verified order_id $verified_order_id does not match expected $ORDER_ID" >&2
  exit 1
fi

echo "Retrieving order with recovered token..."
order_json="$(api_get "/store/order-access/$access_token")"
retrieved_order_id="$(json_get "$order_json" '.order.id')"

if [[ "$retrieved_order_id" != "$ORDER_ID" ]]; then
  echo "Retrieved order_id $retrieved_order_id does not match expected $ORDER_ID" >&2
  exit 1
fi

echo "Recovery smoke test passed"
echo "order_id=$ORDER_ID"
echo "recovery_code=$recovery_code"
echo "access_token=$access_token"
