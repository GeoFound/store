#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:9002}"
PROVIDER_ORDER_ID=""
STATUS="paid"

usage() {
  cat <<USAGE
usage: MANUAL_WEBHOOK_SECRET=... scripts/deploy/send-manual-webhook.sh --provider-order-id <id> [--status paid|failed] [--backend-url <url>]
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --provider-order-id)
      if [[ $# -lt 2 ]]; then
        echo "--provider-order-id requires a value" >&2
        exit 2
      fi
      PROVIDER_ORDER_ID="$2"
      shift 2
      ;;
    --status)
      if [[ $# -lt 2 ]]; then
        echo "--status requires a value" >&2
        exit 2
      fi
      STATUS="$2"
      shift 2
      ;;
    --backend-url)
      if [[ $# -lt 2 ]]; then
        echo "--backend-url requires a value" >&2
        exit 2
      fi
      BACKEND_URL="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$PROVIDER_ORDER_ID" ]]; then
  echo "--provider-order-id is required" >&2
  exit 2
fi

if [[ -z "${MANUAL_WEBHOOK_SECRET:-}" ]]; then
  echo "MANUAL_WEBHOOK_SECRET is required" >&2
  exit 2
fi

payload="{\"provider_order_id\":\"$PROVIDER_ORDER_ID\",\"status\":\"$STATUS\"}"
timestamp="$(date +%s)"
signature="$(printf '%s' "${timestamp}.${payload}" | openssl dgst -sha256 -hmac "$MANUAL_WEBHOOK_SECRET" -hex | awk '{print $NF}')"

curl -fsS \
  -H "Content-Type: application/json" \
  -H "x-manual-webhook-timestamp: $timestamp" \
  -H "x-manual-webhook-signature: $signature" \
  -X POST \
  -d "$payload" \
  "$BACKEND_URL/hooks/payment/manual"

echo
echo "manual webhook sent"
