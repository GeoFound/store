#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-}"
RATE_LIMIT_SMOKE_PATH="${RATE_LIMIT_SMOKE_PATH:-/store/orders/recover}"
RATE_LIMIT_SMOKE_EMAIL="${RATE_LIMIT_SMOKE_EMAIL:-rate-limit-smoke@example.invalid}"
RATE_LIMIT_SMOKE_IP="${RATE_LIMIT_SMOKE_IP:-198.51.100.44}"
RATE_LIMIT_SMOKE_MAX_REQUESTS="${RATE_LIMIT_SMOKE_MAX_REQUESTS:-}"
RATE_LIMIT_SMOKE_EXPECT_STATUS="${RATE_LIMIT_SMOKE_EXPECT_STATUS:-429}"
CURL_TIMEOUT_SECONDS="${CURL_TIMEOUT_SECONDS:-10}"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 2
  fi
}

read_env_value() {
  local name="$1"
  if [[ -n "$BACKEND_ENV_FILE" && -f "$BACKEND_ENV_FILE" ]]; then
    awk -F= -v key="$name" '$1 == key {print substr($0, length(key) + 2)}' "$BACKEND_ENV_FILE" | tail -n 1
  fi
}

first_csv_value() {
  local value="$1"
  printf '%s' "$value" | awk -F, '{print $1}'
}

url_host() {
  URL_VALUE="$1" node -e '
const value = process.env.URL_VALUE || "";
try {
  const url = new URL(value);
  process.stdout.write(url.host);
} catch {
  process.stdout.write("");
}
'
}

require_cmd curl
require_cmd node

if [[ -z "$BACKEND_URL" && -n "${API_HEALTH_URL:-}" ]]; then
  BACKEND_URL="${API_HEALTH_URL%/health}"
fi

if [[ -z "$BACKEND_URL" ]]; then
  echo "Missing BACKEND_URL or API_HEALTH_URL for rate-limit smoke" >&2
  exit 2
fi

if [[ -z "$RATE_LIMIT_SMOKE_MAX_REQUESTS" ]]; then
  RATE_LIMIT_SMOKE_MAX_REQUESTS="$(read_env_value SECURITY_LIMIT_RECOVER_REQUEST_MAX_REQUESTS)"
fi
RATE_LIMIT_SMOKE_MAX_REQUESTS="${RATE_LIMIT_SMOKE_MAX_REQUESTS:-5}"

host_header="${RATE_LIMIT_SMOKE_HOST:-}"
if [[ -z "$host_header" ]]; then
  host_header="$(first_csv_value "$(read_env_value TENANT_ALLOWED_HOSTS)")"
fi
if [[ -z "$host_header" ]]; then
  host_header="$(url_host "$BACKEND_URL")"
fi

origin_header="${RATE_LIMIT_SMOKE_ORIGIN:-}"
if [[ -z "$origin_header" ]]; then
  origin_header="$(first_csv_value "$(read_env_value STORE_CORS)")"
fi

url="${BACKEND_URL%/}$RATE_LIMIT_SMOKE_PATH"
limit=$((RATE_LIMIT_SMOKE_MAX_REQUESTS + 1))
last_status=""

for attempt in $(seq 1 "$limit"); do
  headers=(
    -H "Content-Type: application/json"
    -H "User-Agent: store-rate-limit-smoke"
    -H "X-Forwarded-For: $RATE_LIMIT_SMOKE_IP"
  )

  if [[ -n "$host_header" ]]; then
    headers+=(-H "Host: $host_header")
  fi

  if [[ -n "$origin_header" ]]; then
    headers+=(-H "Origin: $origin_header")
  fi

  last_status="$(
    curl -sS -o /dev/null -w '%{http_code}' --max-time "$CURL_TIMEOUT_SECONDS" \
      -X POST "${headers[@]}" \
      --data "{\"email\":\"$RATE_LIMIT_SMOKE_EMAIL\"}" \
      "$url" || true
  )"

  if [[ "$last_status" == "$RATE_LIMIT_SMOKE_EXPECT_STATUS" ]]; then
    echo "rate-limit-smoke: ok ($attempt/$limit returned $last_status)"
    exit 0
  fi
done

echo "rate-limit-smoke: expected $RATE_LIMIT_SMOKE_EXPECT_STATUS within $limit requests, last status was ${last_status:-none}" >&2
exit 1
