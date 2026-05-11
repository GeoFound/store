#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
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
JWT_SECRET="${JWT_SECRET:-store_live_smoke_jwt_secret}"
COOKIE_SECRET="${COOKIE_SECRET:-store_live_smoke_cookie_secret}"
MANUAL_WEBHOOK_SECRET="${MANUAL_WEBHOOK_SECRET:-store_live_smoke_webhook_secret}"

if [[ -z "$ORDER_ID" ]]; then
  echo "ORDER_ID is required" >&2
  exit 1
fi

mkdir -p "$XDG_CONFIG_HOME"
mkdir -p "$SMOKE_HOME"

if [[ -f "$ROOT_DIR/apps/storefront/.env.local" ]]; then
  set -a
  source "$ROOT_DIR/apps/storefront/.env.local"
  set +a
fi

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
  rm -f "$BACKEND_LOG" "$STOREFRONT_LOG"

  echo "Starting backend..."
  (
    cd "$ROOT_DIR"
    HOME="$SMOKE_HOME" \
    XDG_CONFIG_HOME="$XDG_CONFIG_HOME" \
    JWT_SECRET="$JWT_SECRET" \
    COOKIE_SECRET="$COOKIE_SECRET" \
    MANUAL_WEBHOOK_SECRET="$MANUAL_WEBHOOK_SECRET" \
    pnpm dev:backend >"$BACKEND_LOG" 2>&1
  ) &
  backend_pid="$!"

  if [[ "$REQUIRE_STOREFRONT_HEALTH" == "1" ]]; then
    echo "Starting storefront..."
    (
      cd "$ROOT_DIR"
      HOSTNAME=127.0.0.1 pnpm dev:storefront >"$STOREFRONT_LOG" 2>&1
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
