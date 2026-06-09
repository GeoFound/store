#!/usr/bin/env bash
set -euo pipefail

API_PUBLIC_URL="${API_PUBLIC_URL:-}"
ADMIN_EDGE_PROBE_PATHS="${ADMIN_EDGE_PROBE_PATHS:-/app /admin/ops-control/security}"
EXPECT_CLOUDFLARE="${EXPECT_CLOUDFLARE:-true}"
EXPECT_CLOUDFLARE_ACCESS="${EXPECT_CLOUDFLARE_ACCESS:-true}"
CURL_TIMEOUT_SECONDS="${CURL_TIMEOUT_SECONDS:-10}"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 2
  fi
}

is_truthy() {
  local normalized
  normalized="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  [[ "$normalized" == "1" || "$normalized" == "true" || "$normalized" == "yes" || "$normalized" == "on" ]]
}

join_url() {
  local base="${1%/}"
  local path="$2"
  printf '%s%s' "$base" "$path"
}

fetch_headers() {
  local url="$1"
  curl -sS --max-time "$CURL_TIMEOUT_SECONDS" -D - -o /dev/null "$url" || true
}

extract_status_code() {
  awk '/^HTTP\//{code=$2} END{print code}'
}

extract_location() {
  awk -F': ' 'tolower($1)=="location"{print $2}' | tr -d '\r' | tail -n 1
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

assert_access_protected() {
  local url="$1"
  local headers="$2"
  local status
  local location

  status="$(printf '%s\n' "$headers" | extract_status_code)"
  location="$(printf '%s\n' "$headers" | extract_location)"

  if [[ -z "$status" ]]; then
    echo "Unable to read HTTP status for $url" >&2
    return 1
  fi

  if [[ "$status" =~ ^(401|403)$ ]]; then
    return 0
  fi

  if [[ "$status" =~ ^3[0-9][0-9]$ ]] && printf '%s' "$location" | grep -Eiq 'cloudflareaccess|/cdn-cgi/access'; then
    return 0
  fi

  echo "Admin URL is not edge protected: $url returned $status ${location:-}" >&2
  return 1
}

require_cmd curl

if [[ -z "$API_PUBLIC_URL" ]]; then
  echo "Missing required env: API_PUBLIC_URL" >&2
  exit 2
fi

for path in $ADMIN_EDGE_PROBE_PATHS; do
  url="$(join_url "$API_PUBLIC_URL" "$path")"
  headers="$(fetch_headers "$url")"

  if is_truthy "$EXPECT_CLOUDFLARE"; then
    assert_cloudflare_headers "$url" "$headers"
  fi

  if is_truthy "$EXPECT_CLOUDFLARE_ACCESS"; then
    assert_access_protected "$url" "$headers"
  fi
done

echo "admin-edge-protection: ok"
