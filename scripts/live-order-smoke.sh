#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_URL="${BACKEND_URL:-http://localhost:9002}"
STOREFRONT_URL="${STOREFRONT_URL:-http://localhost:8000}"
BUYER_EMAIL="${BUYER_EMAIL:-buyer@example.com}"
BACKEND_LOG="${BACKEND_LOG:-/tmp/store-backend-smoke.log}"
STOREFRONT_LOG="${STOREFRONT_LOG:-/tmp/store-storefront-smoke.log}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-store-postgres}"
MANAGE_SERVICES="${MANAGE_SERVICES:-1}"
RUN_RECOVERY_SMOKE="${RUN_RECOVERY_SMOKE:-0}"
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-/tmp/store-smoke-config}"
SMOKE_HOME="${SMOKE_HOME:-/tmp/store-smoke-home}"
MANUAL_WEBHOOK_SECRET="${MANUAL_WEBHOOK_SECRET:-}"
JWT_SECRET="${JWT_SECRET:-store_live_smoke_jwt_secret}"
COOKIE_SECRET="${COOKIE_SECRET:-store_live_smoke_cookie_secret}"

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

if [[ "$MANAGE_SERVICES" == "1" ]]; then
  MANUAL_WEBHOOK_SECRET="${MANUAL_WEBHOOK_SECRET:-store_live_smoke_webhook_secret}"
fi

if [[ -z "$MANUAL_WEBHOOK_SECRET" ]]; then
  echo "Missing MANUAL_WEBHOOK_SECRET (required for signed manual webhook calls)" >&2
  exit 1
fi

mkdir -p "$XDG_CONFIG_HOME" "$SMOKE_HOME"

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

api_post_with_status() {
  local path="$1"
  local body="$2"
  local response_file="$3"

  curl -sS \
    -H "Content-Type: application/json" \
    -H "x-publishable-api-key: $PUBLISHABLE_KEY" \
    -X POST \
    -d "$body" \
    -o "$response_file" \
    -w "%{http_code}" \
    "$BACKEND_URL$path"
}

manual_webhook_signature() {
  local timestamp="$1"
  local payload="$2"

  printf '%s' "${timestamp}.${payload}" \
    | openssl dgst -sha256 -hmac "$MANUAL_WEBHOOK_SECRET" -hex \
    | awk '{print $NF}'
}

if [[ "$MANAGE_SERVICES" == "1" ]]; then
  rm -f "$BACKEND_LOG" "$STOREFRONT_LOG"

  echo "Starting backend..."
  (
    cd "$ROOT_DIR"
    HOME="$SMOKE_HOME" \
    XDG_CONFIG_HOME="$XDG_CONFIG_HOME" \
    MANUAL_WEBHOOK_SECRET="$MANUAL_WEBHOOK_SECRET" \
    JWT_SECRET="$JWT_SECRET" \
    COOKIE_SECRET="$COOKIE_SECRET" \
    pnpm dev:backend >"$BACKEND_LOG" 2>&1
  ) &
  backend_pid="$!"

  echo "Starting storefront..."
  (
    cd "$ROOT_DIR"
    HOSTNAME=127.0.0.1 pnpm dev:storefront >"$STOREFRONT_LOG" 2>&1
  ) &
  storefront_pid="$!"
fi

wait_for_url "$BACKEND_URL/health"
wait_for_url "$STOREFRONT_URL/api/health"

echo "Fetching region and product data..."
regions_json="$(api_get "/store/regions")"
region_id="$(json_get "$regions_json" '.regions[0].id')"
products_json="$(api_get "/store/products?limit=1&region_id=$region_id&fields=id,title,handle,*variants")"
variant_id="$(
  docker exec "$POSTGRES_CONTAINER" \
    psql -U store -d store -tAc \
    "select product_variant_id from account_item where status = 'in_stock' group by product_variant_id order by count(*) desc, product_variant_id limit 1;"
)"
variant_id="$(printf '%s' "$variant_id" | tr -d '[:space:]')"

if [[ -z "$variant_id" ]]; then
  echo "No in_stock credential inventory is available for the live smoke test" >&2
  exit 1
fi

echo "Creating cart..."
cart_json="$(api_post "/store/carts" "{\"region_id\":\"$region_id\"}")"
cart_id="$(json_get "$cart_json" '.cart.id')"

echo "Adding variant $variant_id to cart $cart_id..."
cart_with_item_json="$(api_post "/store/carts/$cart_id/line-items" "{\"variant_id\":\"$variant_id\",\"quantity\":1}")"
item_count="$(json_get "$cart_with_item_json" '.cart.items | length')"

if [[ "$item_count" -lt 1 ]]; then
  echo "Cart is still empty after adding a line item" >&2
  exit 1
fi

echo "Binding guest email..."
api_post "/store/carts/$cart_id" "{\"email\":\"$BUYER_EMAIL\"}" >/dev/null

echo "Creating payment attempt..."
payment_json="$(api_post "/store/carts/$cart_id/payments" '{"payment_method":"manual"}')"
attempt_id="$(json_get "$payment_json" '.attempt.id')"
provider_order_id="$(json_get "$payment_json" '.attempt.provider_order_id')"
claim_token="$(json_get "$payment_json" '.claim_token')"

echo "Confirming payment through manual webhook..."
manual_webhook_payload="{\"provider_order_id\":\"$provider_order_id\",\"status\":\"paid\"}"
manual_webhook_timestamp="$(date +%s)"
manual_webhook_signature_value="$(
  manual_webhook_signature "$manual_webhook_timestamp" "$manual_webhook_payload"
)"
curl -fsS \
  -H "Content-Type: application/json" \
  -H "x-manual-webhook-timestamp: $manual_webhook_timestamp" \
  -H "x-manual-webhook-signature: $manual_webhook_signature_value" \
  -X POST \
  -d "$manual_webhook_payload" \
  "$BACKEND_URL/hooks/payment/manual" >/dev/null

attempt_status=""
order_id=""
for _ in $(seq 1 30); do
  attempt_json="$(api_get "/store/payment-attempts/$attempt_id")"
  attempt_status="$(json_get "$attempt_json" '.attempt.status')"
  if [[ "$attempt_status" == "paid" ]]; then
    order_id="$(json_get "$attempt_json" '.attempt.order_id')"
    break
  fi
  sleep 1
done

if [[ "$attempt_status" != "paid" ]]; then
  echo "Payment attempt did not transition to paid" >&2
  exit 1
fi

echo "Claiming order access..."
claim_response_1="$(mktemp)"
claim_response_2="$(mktemp)"
claim_status_1_file="$(mktemp)"
claim_status_2_file="$(mktemp)"

(
  api_post_with_status \
    "/store/payment-attempts/$attempt_id/claim-order-access" \
    "{\"claim_token\":\"$claim_token\"}" \
    "$claim_response_1" >"$claim_status_1_file"
) &
claim_pid_1="$!"

(
  api_post_with_status \
    "/store/payment-attempts/$attempt_id/claim-order-access" \
    "{\"claim_token\":\"$claim_token\"}" \
    "$claim_response_2" >"$claim_status_2_file"
) &
claim_pid_2="$!"

wait "$claim_pid_1"
wait "$claim_pid_2"

claim_status_1="$(cat "$claim_status_1_file")"
claim_status_2="$(cat "$claim_status_2_file")"

claim_json=""
if [[ "$claim_status_1" =~ ^2 ]] && jq -e '.access_token and .order_id' "$claim_response_1" >/dev/null 2>&1; then
  claim_json="$(cat "$claim_response_1")"
fi

if [[ "$claim_status_2" =~ ^2 ]] && jq -e '.access_token and .order_id' "$claim_response_2" >/dev/null 2>&1; then
  if [[ -n "$claim_json" ]]; then
    echo "Concurrent claim protection failed: both claim requests succeeded" >&2
    exit 1
  fi
  claim_json="$(cat "$claim_response_2")"
fi

if [[ -z "$claim_json" ]]; then
  echo "Concurrent claim protection failed: no successful claim response" >&2
  echo "claim_status_1=$claim_status_1 body=$(cat "$claim_response_1")" >&2
  echo "claim_status_2=$claim_status_2 body=$(cat "$claim_response_2")" >&2
  exit 1
fi

access_token="$(json_get "$claim_json" '.access_token')"
claimed_order_id="$(json_get "$claim_json" '.order_id')"

if [[ "$claimed_order_id" != "$order_id" ]]; then
  echo "Claimed order_id $claimed_order_id does not match payment attempt order_id $order_id" >&2
  exit 1
fi

if [[ "$claim_status_1" =~ ^2 ]] && [[ "$claim_status_2" =~ ^2 ]]; then
  echo "Concurrent claim protection failed: both claim requests returned success codes" >&2
  exit 1
fi

echo "Replaying manual webhook to verify idempotency and token stability..."
manual_webhook_replay_timestamp="$(date +%s)"
manual_webhook_replay_signature="$(
  manual_webhook_signature "$manual_webhook_replay_timestamp" "$manual_webhook_payload"
)"
curl -fsS \
  -H "Content-Type: application/json" \
  -H "x-manual-webhook-timestamp: $manual_webhook_replay_timestamp" \
  -H "x-manual-webhook-signature: $manual_webhook_replay_signature" \
  -X POST \
  -d "$manual_webhook_payload" \
  "$BACKEND_URL/hooks/payment/manual" >/dev/null

echo "Retrieving guest order..."
order_json="$(api_get "/store/order-access/$access_token")"
retrieved_order_id="$(json_get "$order_json" '.order.id')"
delivery_count="$(printf '%s' "$order_json" | jq -er '.deliveries | length')"

if [[ "$retrieved_order_id" != "$order_id" ]]; then
  echo "Retrieved order_id $retrieved_order_id does not match expected $order_id" >&2
  exit 1
fi

if [[ "$delivery_count" -lt 1 ]]; then
  echo "Payment was paid, but no delivery was created for order $order_id" >&2
  exit 1
fi

replayed_attempt_json="$(api_get "/store/payment-attempts/$attempt_id")"
replayed_attempt_status="$(json_get "$replayed_attempt_json" '.attempt.status')"

if [[ "$replayed_attempt_status" != "paid" ]]; then
  echo "Webhook replay changed payment attempt status unexpectedly: $replayed_attempt_status" >&2
  exit 1
fi

if ! printf '%s' "$order_json" | jq -e '.deliveries[0].delivery.delivery_status == "delivered" or .deliveries[0].delivery.delivery_status == "confirmed"' >/dev/null; then
  echo "First delivery is not in a readable delivered state" >&2
  exit 1
fi

if ! printf '%s' "$order_json" | jq -e '(.deliveries[0].payload | type) as $type | ($type == "object" and (.deliveries[0].payload | length > 0)) or ($type == "string" and (.deliveries[0].payload | length > 0))' >/dev/null; then
  echo "First delivery payload is missing or empty" >&2
  exit 1
fi

echo "Smoke test passed"
echo "cart_id=$cart_id"
echo "attempt_id=$attempt_id"
echo "order_id=$order_id"
echo "access_token=$access_token"
echo "deliveries=$delivery_count"

rm -f "$claim_response_1" "$claim_response_2" "$claim_status_1_file" "$claim_status_2_file"

if [[ "$RUN_RECOVERY_SMOKE" == "1" ]]; then
  echo "Requesting recovery code..."
  api_post "/store/orders/recover" "{\"email\":\"$BUYER_EMAIL\",\"order_id\":\"$order_id\"}" >/dev/null

  recovery_code=""
  for _ in $(seq 1 30); do
    recovery_code="$(
      docker exec "$POSTGRES_CONTAINER" \
        psql -U store -d store -tAc \
        "select data->>'code' from notification where template = 'guest-order-recovery' and data->>'order_id' = '$order_id' order by created_at desc limit 1;"
    )"
    recovery_code="$(printf '%s' "$recovery_code" | tr -d '[:space:]')"
    if [[ -n "$recovery_code" ]]; then
      break
    fi
    sleep 1
  done

  if [[ -z "$recovery_code" ]]; then
    echo "Recovery code was not found in backend log output" >&2
    exit 1
  fi

  echo "Verifying recovery code..."
  verify_json="$(api_post "/store/orders/recover/verify" "{\"order_id\":\"$order_id\",\"code\":\"$recovery_code\"}")"
  recovered_access_token="$(json_get "$verify_json" '.access_token')"
  verified_order_id="$(json_get "$verify_json" '.order_id')"

  if [[ "$verified_order_id" != "$order_id" ]]; then
    echo "Verified order_id $verified_order_id does not match expected $order_id" >&2
    exit 1
  fi

  echo "Retrieving recovered order..."
  recovered_order_json="$(api_get "/store/order-access/$recovered_access_token")"
  recovered_order_id="$(json_get "$recovered_order_json" '.order.id')"
  recovered_delivery_count="$(printf '%s' "$recovered_order_json" | jq -er '.deliveries | length')"

  if [[ "$recovered_order_id" != "$order_id" ]]; then
    echo "Recovered order_id $recovered_order_id does not match expected $order_id" >&2
    exit 1
  fi

  if [[ "$recovered_delivery_count" -lt 1 ]]; then
    echo "Recovered order view has no deliveries" >&2
    exit 1
  fi

  if ! printf '%s' "$recovered_order_json" | jq -e '(.deliveries[0].payload | type) as $type | ($type == "object" and (.deliveries[0].payload | length > 0)) or ($type == "string" and (.deliveries[0].payload | length > 0))' >/dev/null; then
    echo "Recovered order delivery payload is missing or empty" >&2
    exit 1
  fi

  echo "Recovery smoke test passed"
  echo "recovery_code=$recovery_code"
  echo "recovered_access_token=$recovered_access_token"
fi
