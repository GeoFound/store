#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:9002}"
STOREFRONT_URL="${STOREFRONT_URL:-http://127.0.0.1:8000}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-/opt/store/shared/backend.env}"
BUYER_EMAIL="${BUYER_EMAIL:-release-smoke@example.com}"

if [[ -z "${MANUAL_WEBHOOK_SECRET:-}" ]] && [[ -f "$BACKEND_ENV_FILE" ]]; then
  set -a
  source "$BACKEND_ENV_FILE"
  set +a
fi

if [[ -z "${MANUAL_WEBHOOK_SECRET:-}" ]]; then
  echo "MANUAL_WEBHOOK_SECRET is required. Export it or provide BACKEND_ENV_FILE." >&2
  exit 2
fi

cd "$ROOT_DIR"

BACKEND_URL="$BACKEND_URL" \
STOREFRONT_URL="$STOREFRONT_URL" \
BUYER_EMAIL="$BUYER_EMAIL" \
MANAGE_SERVICES=0 \
RUN_RECOVERY_SMOKE=1 \
MANUAL_WEBHOOK_SECRET="$MANUAL_WEBHOOK_SECRET" \
  bash scripts/live-order-smoke.sh
