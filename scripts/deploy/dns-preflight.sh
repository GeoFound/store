#!/usr/bin/env bash
set -euo pipefail

STOREFRONT_PUBLIC_URL="${STOREFRONT_PUBLIC_URL:-}"
API_PUBLIC_URL="${API_PUBLIC_URL:-}"
EXPECT_CLOUDFLARE="${EXPECT_CLOUDFLARE:-true}"
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
  local normalized
  normalized="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  [[ "$normalized" == "1" || "$normalized" == "true" || "$normalized" == "yes" || "$normalized" == "on" ]]
}

ensure_required_input() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    echo "Missing required env for DNS preflight: $name" >&2
    exit 2
  fi
}

url_host() {
  URL_VALUE="$1" node -e '
const value = process.env.URL_VALUE || "";
try {
  const parsed = new URL(value);
  process.stdout.write(parsed.hostname);
} catch {
  process.stdout.write("");
  process.exit(1);
}
'
}

assert_resolves() {
  local host="$1"
  HOST_VALUE="$host" node -e '
const dns = require("node:dns").promises;
const host = process.env.HOST_VALUE || "";
(async () => {
  const results = [];
  try { results.push(...await dns.resolve4(host)); } catch {}
  try { results.push(...await dns.resolve6(host)); } catch {}
  if (!results.length) {
    console.error(`DNS did not resolve for ${host}`);
    process.exit(1);
  }
})().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
'
}

assert_cloudflare_dns_record() {
  local host="$1"

  if [[ -z "$CLOUDFLARE_ZONE_ID" || -z "$CLOUDFLARE_API_TOKEN" ]]; then
    echo "Skipping Cloudflare DNS API check for $host (CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN missing)."
    return 0
  fi

  local response
  response="$(
    curl -sS --max-time "$CURL_TIMEOUT_SECONDS" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" \
      "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records?name=$host"
  )"

  RESPONSE_JSON="$response" HOST_VALUE="$host" EXPECT_PROXY="$EXPECT_CLOUDFLARE" node -e '
const payload = process.env.RESPONSE_JSON || "";
const host = process.env.HOST_VALUE || "";
const expectProxy = ["1", "true", "yes", "on"].includes(String(process.env.EXPECT_PROXY || "").toLowerCase());
let parsed;
try {
  parsed = JSON.parse(payload);
} catch {
  console.error("Unable to parse Cloudflare DNS records response");
  process.exit(1);
}
if (!parsed || parsed.success !== true || !Array.isArray(parsed.result)) {
  console.error("Cloudflare DNS records API did not return success");
  process.exit(1);
}
const records = parsed.result.filter((record) => record && record.name === host);
if (!records.length) {
  console.error(`No Cloudflare DNS record found for ${host}`);
  process.exit(1);
}
if (expectProxy && !records.some((record) => record.proxied === true)) {
  console.error(`Cloudflare DNS record for ${host} is not proxied`);
  process.exit(1);
}
'
}

check_url() {
  local url="$1"
  local host
  host="$(url_host "$url")"

  if [[ -z "$host" ]]; then
    echo "Unable to read host from URL: $url" >&2
    return 1
  fi

  assert_resolves "$host"
  assert_cloudflare_dns_record "$host"
}

require_cmd curl
require_cmd node

ensure_required_input STOREFRONT_PUBLIC_URL
ensure_required_input API_PUBLIC_URL

check_url "$STOREFRONT_PUBLIC_URL"
check_url "$API_PUBLIC_URL"

echo "dns-preflight: ok"
