#!/usr/bin/env bash
set -euo pipefail

STOREFRONT_PUBLIC_URL="${STOREFRONT_PUBLIC_URL:-}"
API_PUBLIC_URL="${API_PUBLIC_URL:-}"
EXPECT_CLOUDFLARE="${EXPECT_CLOUDFLARE:-false}"
REQUIRE_HTTPS="${REQUIRE_HTTPS:-true}"
REQUIRE_HSTS_HEADER="${REQUIRE_HSTS_HEADER:-true}"
REQUIRE_HTTP_REDIRECT_TO_HTTPS="${REQUIRE_HTTP_REDIRECT_TO_HTTPS:-false}"
REQUIRE_CLOUDFLARE_SSL_MODE="${REQUIRE_CLOUDFLARE_SSL_MODE:-strict}"
CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID:-}"
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
CURL_TIMEOUT_SECONDS="${CURL_TIMEOUT_SECONDS:-10}"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 2
  fi
}

is_truthy() {
  local value="${1:-}"
  local normalized
  normalized="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  [[ "$normalized" == "1" || "$normalized" == "true" || "$normalized" == "yes" || "$normalized" == "on" ]]
}

ensure_required_input() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    echo "Missing required env for edge preflight: $name" >&2
    exit 2
  fi
}

assert_https_url() {
  local url="$1"

  if ! [[ "$url" =~ ^https:// ]]; then
    echo "Expected HTTPS URL, got: $url" >&2
    return 1
  fi
}

fetch_headers() {
  local url="$1"
  curl -sS -L --max-time "$CURL_TIMEOUT_SECONDS" -D - -o /dev/null "$url"
}

extract_status_code() {
  local headers="$1"
  printf '%s\n' "$headers" | awk '/^HTTP\//{code=$2} END{print code}'
}

assert_successful_status() {
  local url="$1"
  local status="$2"

  if [[ -z "$status" ]]; then
    echo "Unable to read HTTP status for $url" >&2
    return 1
  fi

  if (( status >= 400 )); then
    echo "Public URL returned status >= 400: $url ($status)" >&2
    return 1
  fi
}

assert_hsts_header() {
  local url="$1"
  local headers="$2"

  if ! printf '%s\n' "$headers" | grep -qi '^strict-transport-security:'; then
    echo "Missing Strict-Transport-Security header on $url" >&2
    return 1
  fi
}

assert_cloudflare_headers() {
  local url="$1"
  local headers="$2"

  if printf '%s\n' "$headers" | grep -qi '^cf-ray:'; then
    return 0
  fi

  if printf '%s\n' "$headers" | grep -qi '^server:[[:space:]]*cloudflare'; then
    return 0
  fi

  echo "Expected Cloudflare edge headers were not found on $url" >&2
  return 1
}

to_http_url() {
  local input="$1"
  URL_VALUE="$input" node -e '
const value = process.env.URL_VALUE || "";
try {
  const parsed = new URL(value);
  parsed.protocol = "http:";
  process.stdout.write(parsed.toString());
} catch {
  process.stdout.write("");
}
'
}

assert_http_redirect_to_https() {
  local https_url="$1"
  local http_url
  http_url="$(to_http_url "$https_url")"

  if [[ -z "$http_url" ]]; then
    echo "Unable to derive HTTP URL from $https_url" >&2
    return 1
  fi

  local headers
  headers="$(curl -sS --max-time "$CURL_TIMEOUT_SECONDS" -D - -o /dev/null "$http_url" || true)"

  local status
  status="$(extract_status_code "$headers")"
  local location
  location="$(printf '%s\n' "$headers" | awk -F': ' 'tolower($1)=="location"{print $2}' | tr -d '\r' | tail -n 1)"

  if [[ -z "$status" || "$status" -lt 300 || "$status" -gt 399 ]]; then
    echo "Expected HTTP->HTTPS redirect on $http_url, got status: ${status:-unknown}" >&2
    return 1
  fi

  if ! [[ "$location" =~ ^https:// ]]; then
    echo "Expected redirect target to HTTPS on $http_url, got location: ${location:-empty}" >&2
    return 1
  fi
}

check_public_endpoint() {
  local url="$1"

  if is_truthy "$REQUIRE_HTTPS"; then
    assert_https_url "$url"
  fi

  local headers
  headers="$(fetch_headers "$url")"

  local status
  status="$(extract_status_code "$headers")"
  assert_successful_status "$url" "$status"

  if is_truthy "$REQUIRE_HSTS_HEADER" && [[ "$url" =~ ^https:// ]]; then
    assert_hsts_header "$url" "$headers"
  fi

  if is_truthy "$EXPECT_CLOUDFLARE"; then
    assert_cloudflare_headers "$url" "$headers"
  fi

  if is_truthy "$REQUIRE_HTTP_REDIRECT_TO_HTTPS" && [[ "$url" =~ ^https:// ]]; then
    assert_http_redirect_to_https "$url"
  fi
}

check_cloudflare_ssl_mode() {
  if ! is_truthy "$EXPECT_CLOUDFLARE"; then
    return 0
  fi

  if [[ -z "$CLOUDFLARE_ZONE_ID" || -z "$CLOUDFLARE_API_TOKEN" ]]; then
    echo "Skipping Cloudflare SSL mode API check (CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN missing)."
    return 0
  fi

  local response
  response="$(
    curl -sS --max-time "$CURL_TIMEOUT_SECONDS" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" \
      "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/settings/ssl"
  )"

  local ssl_mode
  ssl_mode="$(
    RESPONSE_JSON="$response" node -e '
const payload = process.env.RESPONSE_JSON || "";
try {
  const parsed = JSON.parse(payload);
  if (parsed && parsed.success && parsed.result && typeof parsed.result.value === "string") {
    process.stdout.write(parsed.result.value);
    process.exit(0);
  }
} catch {}
process.stdout.write("");
process.exit(1);
'
  )" || {
    echo "Unable to parse Cloudflare SSL mode response" >&2
    return 1
  }

  if [[ "$ssl_mode" != "$REQUIRE_CLOUDFLARE_SSL_MODE" ]]; then
    echo "Cloudflare SSL mode mismatch: expected '$REQUIRE_CLOUDFLARE_SSL_MODE', got '$ssl_mode'" >&2
    return 1
  fi
}

require_cmd curl
require_cmd node

ensure_required_input STOREFRONT_PUBLIC_URL
ensure_required_input API_PUBLIC_URL

check_public_endpoint "$STOREFRONT_PUBLIC_URL"
check_public_endpoint "$API_PUBLIC_URL"
check_cloudflare_ssl_mode

echo "edge-preflight: ok"
