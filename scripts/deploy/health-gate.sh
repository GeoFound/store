#!/usr/bin/env bash
set -euo pipefail

BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:9002/health}"
STOREFRONT_HEALTH_URL="${STOREFRONT_HEALTH_URL:-http://127.0.0.1:8000/api/health}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-45}"
HEALTH_SLEEP_SECONDS="${HEALTH_SLEEP_SECONDS:-2}"
CURL_TIMEOUT_SECONDS="${CURL_TIMEOUT_SECONDS:-5}"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 2
  fi
}

wait_for_url() {
  local url="$1"
  local attempts="$2"
  local sleep_seconds="$3"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS --max-time "$CURL_TIMEOUT_SECONDS" "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$sleep_seconds"
  done

  echo "Timed out waiting for $url" >&2
  return 1
}

require_cmd curl

wait_for_url "$BACKEND_HEALTH_URL" "$HEALTH_ATTEMPTS" "$HEALTH_SLEEP_SECONDS"
wait_for_url "$STOREFRONT_HEALTH_URL" "$HEALTH_ATTEMPTS" "$HEALTH_SLEEP_SECONDS"

echo "health-gate: ok"
