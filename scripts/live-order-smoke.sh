#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT_DIR/scripts/profile/env.sh"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:9002}"
STOREFRONT_URL="${STOREFRONT_URL:-http://127.0.0.1:8000}"
BUYER_EMAIL="${BUYER_EMAIL:-buyer@example.com}"
BACKEND_LOG="${BACKEND_LOG:-/tmp/store-backend-smoke.log}"
STOREFRONT_LOG="${STOREFRONT_LOG:-/tmp/store-storefront-smoke.log}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-store-postgres}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$ROOT_DIR/apps/backend/.env}"
STOREFRONT_ENV_FILE="${STOREFRONT_ENV_FILE:-$ROOT_DIR/apps/storefront/.env.local}"
MANAGE_SERVICES="${MANAGE_SERVICES:-1}"
RUN_RECOVERY_SMOKE="${RUN_RECOVERY_SMOKE:-0}"
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-/tmp/store-smoke-config}"
MANUAL_WEBHOOK_SECRET="${MANUAL_WEBHOOK_SECRET:-}"
JWT_SECRET="${JWT_SECRET:-store_live_smoke_jwt_secret}"
COOKIE_SECRET="${COOKIE_SECRET:-store_live_smoke_cookie_secret}"

require_cmd() {
  local cmd="$1"

  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 2
  fi
}

require_cmd curl
require_cmd docker
require_cmd jq
require_cmd node
require_cmd openssl
require_cmd pnpm

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

resolve_publishable_key() {
  local env_candidate="${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY:-}"
  local db_candidate

  db_candidate="$(
    docker exec "$POSTGRES_CONTAINER" \
      psql -U store -d store -tAc \
      "select token from api_key where type = 'publishable' and revoked_at is null order by created_at desc limit 1;" \
      2>/dev/null || true
  )"
  db_candidate="$(printf '%s' "$db_candidate" | tr -d '[:space:]')"

  if [[ -n "$db_candidate" ]]; then
    printf '%s' "$db_candidate"
    return 0
  fi

  printf '%s' "$env_candidate"
}

select_decryptable_variant_id() {
  local candidates_json
  candidates_json="$(
    docker exec "$POSTGRES_CONTAINER" \
      psql -U store -d store -tAc \
      "select coalesce(json_agg(row_to_json(candidate_rows))::text, '[]') from (
        select distinct on (product_variant_id)
          product_variant_id,
          credential_blob
        from account_item
        where status = 'in_stock'
          and deleted_at is null
        order by product_variant_id, created_at asc
      ) as candidate_rows;"
  )"

  CANDIDATES_JSON="$candidates_json" \
  PRIMARY_KEY="$CREDENTIAL_ENCRYPTION_KEY" \
  PREVIOUS_KEYS="$CREDENTIAL_ENCRYPTION_KEY_PREVIOUS" \
    node -e '
const crypto = require("crypto");
const candidates = JSON.parse(process.env.CANDIDATES_JSON || "[]");
const rawKeys = [
  process.env.PRIMARY_KEY || "",
  ...(process.env.PREVIOUS_KEYS || "").split(/[\n,]/).map((entry) => entry.trim()),
].filter(Boolean);

const keyBuffers = [];
const seen = new Set();
for (const rawKey of rawKeys) {
  if (rawKey.toLowerCase().startsWith("replace-with-") || seen.has(rawKey)) {
    continue;
  }
  const decoded = /^[0-9a-f]{64}$/i.test(rawKey)
    ? Buffer.from(rawKey, "hex")
    : Buffer.from(rawKey, "base64");
  if (decoded.length !== 32) {
    continue;
  }
  seen.add(rawKey);
  keyBuffers.push(decoded);
}

for (const candidate of candidates) {
  if (!candidate || typeof candidate.product_variant_id !== "string" || typeof candidate.credential_blob !== "string") {
    continue;
  }

  let payload;
  try {
    payload = JSON.parse(candidate.credential_blob);
  } catch {
    continue;
  }

  if (
    !payload ||
    payload.alg !== "aes-256-gcm" ||
    typeof payload.iv !== "string" ||
    typeof payload.tag !== "string" ||
    typeof payload.data !== "string"
  ) {
    continue;
  }

  for (const key of keyBuffers) {
    try {
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(payload.iv, "base64")
      );
      decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
      Buffer.concat([
        decipher.update(Buffer.from(payload.data, "base64")),
        decipher.final(),
      ]);
      process.stdout.write(candidate.product_variant_id);
      process.exit(0);
    } catch {
      continue;
    }
  }
}
'
}

encrypt_smoke_credential_blob() {
  local payload_json="$1"

  CREDENTIAL_KEY="$CREDENTIAL_ENCRYPTION_KEY" \
  PAYLOAD_JSON="$payload_json" \
    node -e '
const crypto = require("crypto");
const rawKey = process.env.CREDENTIAL_KEY || "";
const payload = process.env.PAYLOAD_JSON || "{}";
const key = /^[0-9a-f]{64}$/i.test(rawKey)
  ? Buffer.from(rawKey, "hex")
  : Buffer.from(rawKey, "base64");

if (key.length !== 32) {
  process.exit(1);
}

const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
const tag = cipher.getAuthTag();

process.stdout.write(
  JSON.stringify({
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  })
);
'
}

seed_smoke_inventory_for_variant() {
  local variant_id="$1"
  local nonce
  local batch_id
  local item_id
  local account_identifier
  local display_label
  local credential_payload
  local credential_blob

  nonce="$(date +%s)-$RANDOM"
  batch_id="acbatch_smoke_${nonce}"
  item_id="acitem_smoke_${nonce}"
  account_identifier="acct_smoke_${nonce}"
  display_label="Smoke Credential ${nonce}"
  credential_payload="{\"username\":\"smoke_${nonce}\",\"password\":\"smoke_${nonce}\"}"
  credential_blob="$(encrypt_smoke_credential_blob "$credential_payload")"

  docker exec -i "$POSTGRES_CONTAINER" psql -U store -d store <<SQL
begin;
insert into account_batch (
  id,
  name,
  product_variant_id,
  status,
  source_note,
  total_count,
  available_count,
  reserved_count,
  sold_count,
  locked_count,
  metadata_json,
  created_at,
  updated_at
) values (
  '${batch_id}',
  'Live Smoke Auto Batch',
  '${variant_id}',
  'active',
  'live-smoke-auto-seed',
  1,
  1,
  0,
  0,
  0,
  '{"source":"live-smoke-auto-seed"}'::jsonb,
  '1970-01-01T00:00:00.000Z',
  '1970-01-01T00:00:00.000Z'
);

insert into account_item (
  id,
  batch_id,
  product_variant_id,
  status,
  account_identifier,
  display_label,
  credential_blob,
  credential_version,
  source_note,
  metadata_json,
  created_at,
  updated_at
) values (
  '${item_id}',
  '${batch_id}',
  '${variant_id}',
  'in_stock',
  '${account_identifier}',
  '${display_label}',
  '${credential_blob}',
  1,
  'live-smoke-auto-seed',
  '{"source":"live-smoke-auto-seed"}'::jsonb,
  '1970-01-01T00:00:00.000Z',
  '1970-01-01T00:00:00.000Z'
);
commit;
SQL
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
BACKEND_PORT="${BACKEND_PORT:-$(url_port "$BACKEND_URL")}"
STOREFRONT_PORT="${STOREFRONT_PORT:-$(url_port "$STOREFRONT_URL")}"
PUBLISHABLE_KEY="$(resolve_publishable_key)"

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

mkdir -p "$XDG_CONFIG_HOME"

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
  assert_site_profile
  rm -f "$BACKEND_LOG" "$STOREFRONT_LOG"

  echo "Starting backend..."
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

  echo "Starting storefront..."
  (
    cd "$ROOT_DIR"
    SITE_ID="$SITE_ID" \
    SITE_ENV="$SITE_ENV" \
    NEXT_PUBLIC_SITE_ID="$NEXT_PUBLIC_SITE_ID" \
    NEXT_PUBLIC_SITE_ENV="$NEXT_PUBLIC_SITE_ENV" \
    MEDUSA_BACKEND_URL="$BACKEND_URL" \
    NEXT_PUBLIC_MEDUSA_BACKEND_URL="$BACKEND_URL" \
    SITE_PROFILES_ROOT="$SITE_PROFILES_ROOT" \
      pnpm --dir apps/storefront exec next dev --port "$STOREFRONT_PORT" --hostname 127.0.0.1 >"$STOREFRONT_LOG" 2>&1
  ) &
  storefront_pid="$!"
fi

if [[ "$MANAGE_SERVICES" == "1" ]]; then
  wait_for_managed_url "$BACKEND_URL/health" "$backend_pid" "backend" "$BACKEND_LOG"
  wait_for_managed_url "$STOREFRONT_URL/api/health" "$storefront_pid" "storefront" "$STOREFRONT_LOG"
else
  wait_for_url "$BACKEND_URL/health"
  wait_for_url "$STOREFRONT_URL/api/health"
fi

echo "Fetching region and product data..."
regions_json="$(api_get "/store/regions")"
region_id="$(json_get "$regions_json" '.regions[0].id')"
products_json="$(api_get "/store/products?limit=1&region_id=$region_id&fields=id,title,handle,*variants")"
variant_id="$(select_decryptable_variant_id)"
variant_id="$(printf '%s' "$variant_id" | tr -d '[:space:]')"

if [[ -z "$variant_id" ]]; then
  fallback_variant_id="$(
    docker exec "$POSTGRES_CONTAINER" \
      psql -U store -d store -tAc \
      "select product_variant_id from account_item where status = 'in_stock' and deleted_at is null order by created_at asc limit 1;"
  )"
  fallback_variant_id="$(printf '%s' "$fallback_variant_id" | tr -d '[:space:]')"

  if [[ -z "$fallback_variant_id" ]]; then
    fallback_variant_id="$(json_get "$products_json" '.products[0].variants[0].id // empty' || true)"
  fi

  fallback_variant_id="$(printf '%s' "$fallback_variant_id" | tr -d '[:space:]')"

  if [[ -z "$fallback_variant_id" ]]; then
    echo "No decryptable inventory was found and no storefront variant is available for smoke seeding" >&2
    exit 1
  fi

  echo "No decryptable inventory found; seeding temporary smoke inventory for variant $fallback_variant_id..."
  seed_smoke_inventory_for_variant "$fallback_variant_id"
  variant_id="$(select_decryptable_variant_id)"
  variant_id="$(printf '%s' "$variant_id" | tr -d '[:space:]')"
fi

if [[ -z "$variant_id" ]]; then
  echo "Smoke inventory seeding did not produce a decryptable variant" >&2
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
