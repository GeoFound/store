#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUYER_EMAIL="${BUYER_EMAIL:-buyer@example.com}"
order_id=""
smoke_log="$(mktemp)"
backend_pid=""
storefront_pid=""
BACKEND_URL="${BACKEND_URL:-http://localhost:9002}"
STOREFRONT_URL="${STOREFRONT_URL:-http://localhost:8000}"
BACKEND_LOG="${BACKEND_LOG:-/tmp/store-backend-live-acceptance.log}"
STOREFRONT_LOG="${STOREFRONT_LOG:-/tmp/store-storefront-live-acceptance.log}"
MANUAL_WEBHOOK_SECRET="${MANUAL_WEBHOOK_SECRET:-store_live_smoke_webhook_secret}"
JWT_SECRET="${JWT_SECRET:-store_live_smoke_jwt_secret}"
COOKIE_SECRET="${COOKIE_SECRET:-store_live_smoke_cookie_secret}"

cleanup() {
  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
  fi

  if [[ -n "$storefront_pid" ]] && kill -0 "$storefront_pid" 2>/dev/null; then
    kill "$storefront_pid" 2>/dev/null || true
    wait "$storefront_pid" 2>/dev/null || true
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

rm -f "$BACKEND_LOG" "$STOREFRONT_LOG"

echo "Starting shared backend..."
(
  cd "$ROOT_DIR"
  MANUAL_WEBHOOK_SECRET="$MANUAL_WEBHOOK_SECRET" JWT_SECRET="$JWT_SECRET" COOKIE_SECRET="$COOKIE_SECRET" pnpm dev:backend >"$BACKEND_LOG" 2>&1
) &
backend_pid="$!"

echo "Starting shared storefront..."
(
  cd "$ROOT_DIR"
  pnpm dev:storefront >"$STOREFRONT_LOG" 2>&1
) &
storefront_pid="$!"

wait_for_url "$BACKEND_URL/health"
wait_for_url "$STOREFRONT_URL/api/health"

echo "Running live order smoke..."
BUYER_EMAIL="$BUYER_EMAIL" MANAGE_SERVICES=0 MANUAL_WEBHOOK_SECRET="$MANUAL_WEBHOOK_SECRET" JWT_SECRET="$JWT_SECRET" COOKIE_SECRET="$COOKIE_SECRET" bash "$ROOT_DIR/scripts/live-order-smoke.sh" | tee "$smoke_log"

order_id="$(awk -F= '/^order_id=/{print $2}' "$smoke_log" | tail -n 1)"

if [[ -z "$order_id" ]]; then
  echo "Failed to extract order_id from live-order-smoke output" >&2
  exit 1
fi

echo "Running live recovery smoke..."
BUYER_EMAIL="$BUYER_EMAIL" \
ORDER_ID="$order_id" \
MANAGE_SERVICES=0 \
BACKEND_LOG="$BACKEND_LOG" \
STOREFRONT_LOG="$STOREFRONT_LOG" \
bash "$ROOT_DIR/scripts/live-order-recovery-smoke.sh"

echo "Live acceptance passed"
