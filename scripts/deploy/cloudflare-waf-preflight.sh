#!/usr/bin/env bash
set -euo pipefail

CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID:-}"
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
CLOUDFLARE_WAF_MANAGED_RULES_ENABLED="${CLOUDFLARE_WAF_MANAGED_RULES_ENABLED:-false}"
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

if ! is_truthy "$CLOUDFLARE_WAF_MANAGED_RULES_ENABLED"; then
  echo "CLOUDFLARE_WAF_MANAGED_RULES_ENABLED must be true after operator verification." >&2
  exit 1
fi

if [[ -z "$CLOUDFLARE_ZONE_ID" || -z "$CLOUDFLARE_API_TOKEN" ]]; then
  echo "Missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN for WAF managed rules verification." >&2
  exit 2
fi

require_cmd curl
require_cmd node

response="$(
  curl -sS --max-time "$CURL_TIMEOUT_SECONDS" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/rulesets/phases/http_request_firewall_managed/entrypoint"
)"

RESPONSE_JSON="$response" node -e '
const payload = process.env.RESPONSE_JSON || "";
let parsed;
try {
  parsed = JSON.parse(payload);
} catch {
  console.error("Unable to parse Cloudflare WAF ruleset response");
  process.exit(1);
}
if (!parsed || parsed.success !== true || !parsed.result) {
  console.error("Cloudflare WAF ruleset API did not return success");
  process.exit(1);
}
const rules = Array.isArray(parsed.result.rules) ? parsed.result.rules : [];
const managedRule = rules.find((rule) =>
  rule &&
  rule.enabled !== false &&
  rule.action === "execute" &&
  rule.action_parameters &&
  typeof rule.action_parameters.id === "string" &&
  rule.action_parameters.id.trim().length > 0
);
if (!managedRule) {
  console.error("No enabled Cloudflare managed WAF execute rule found in http_request_firewall_managed entrypoint");
  process.exit(1);
}
'

echo "cloudflare-waf-preflight: ok"
