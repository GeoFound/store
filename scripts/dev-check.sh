#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT_DIR/scripts/profile/env.sh"
MODE="standard"
AUTO_START_SERVICES="1"
RUN_LIVE="0"

BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$ROOT_DIR/apps/backend/.env}"
STOREFRONT_ENV_FILE="${STOREFRONT_ENV_FILE:-$ROOT_DIR/apps/storefront/.env.local}"

usage() {
  cat <<USAGE
usage: scripts/dev-check.sh [--quick|--standard|--full] [--no-services-up] [--live]

Modes:
  --quick      Validate toolchain/env and running infra only.
  --standard   Quick checks + migrate + backend build + storefront lint/build. (default)
  --full       Standard checks + test suite (pnpm test).

Options:
  --no-services-up  Do not auto run pnpm services:up.
  --live            After checks, run live acceptance smoke (pnpm acceptance:live).
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quick)
      MODE="quick"
      shift
      ;;
    --standard)
      MODE="standard"
      shift
      ;;
    --full)
      MODE="full"
      shift
      ;;
    --no-services-up)
      AUTO_START_SERVICES="0"
      shift
      ;;
    --live)
      RUN_LIVE="1"
      shift
      ;;
    --)
      shift
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

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 2
  fi
}

section() {
  local title="$1"
  printf '\n[%s]\n' "$title"
}

ensure_env_file() {
  local env_file="$1"
  local template_file="$2"

  if [[ -f "$env_file" ]]; then
    return 0
  fi

  echo "Missing env file: $env_file" >&2
  if [[ -f "$template_file" ]]; then
    echo "Create it from template: cp $template_file $env_file" >&2
  fi
  exit 2
}

load_backend_env() {
  set -a
  source "$BACKEND_ENV_FILE"
  set +a
}

load_storefront_env() {
  set -a
  source "$STOREFRONT_ENV_FILE"
  set +a
}

assert_site_profile_env() {
  local backend_site_id="$1"
  local backend_site_env="$2"
  local storefront_site_id="$3"
  local storefront_site_env="$4"
  local profiles_root="$5"

  if [[ -z "$backend_site_id" ]]; then
    echo "Missing required backend site profile config in $BACKEND_ENV_FILE: SITE_ID" >&2
    exit 2
  fi

  if [[ -z "$backend_site_env" ]]; then
    echo "Missing required backend site profile config in $BACKEND_ENV_FILE: SITE_ENV" >&2
    exit 2
  fi

  if [[ -z "$storefront_site_id" ]]; then
    echo "Missing required storefront site profile config in $STOREFRONT_ENV_FILE: NEXT_PUBLIC_SITE_ID or SITE_ID" >&2
    exit 2
  fi

  if [[ -z "$storefront_site_env" ]]; then
    echo "Missing required storefront site profile config in $STOREFRONT_ENV_FILE: NEXT_PUBLIC_SITE_ENV or SITE_ENV" >&2
    exit 2
  fi

  if [[ "$backend_site_id" != "$storefront_site_id" || "$backend_site_env" != "$storefront_site_env" ]]; then
    echo "Backend/storefront site profile mismatch: backend=$backend_site_id/$backend_site_env storefront=$storefront_site_id/$storefront_site_env" >&2
    exit 2
  fi

  if [[ ! -f "$profiles_root/$backend_site_id/$backend_site_env/site.json" ]]; then
    echo "Site profile file not found: $profiles_root/$backend_site_id/$backend_site_env/site.json" >&2
    exit 2
  fi
}

assert_backend_secret() {
  local name="$1"
  local value="${!name:-}"

  if [[ -z "$value" ]]; then
    echo "Missing required backend secret in $BACKEND_ENV_FILE: $name" >&2
    exit 2
  fi

  if [[ "$value" == "replace-with-"* ]] || [[ "$value" == "supersecret" ]]; then
    echo "Unsafe backend secret value for $name in $BACKEND_ENV_FILE" >&2
    exit 2
  fi
}

assert_encryption_key() {
  local name="$1"
  local value="${!name:-}"

  if [[ -z "$value" ]]; then
    echo "Missing required backend encryption key in $BACKEND_ENV_FILE: $name" >&2
    exit 2
  fi

  if [[ "$value" == "replace-with-"* ]]; then
    echo "Unsafe backend encryption key value for $name in $BACKEND_ENV_FILE" >&2
    exit 2
  fi

  if KEY_VALUE="$value" node -e '
const raw = process.env.KEY_VALUE || "";
const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
if (key.length !== 32) {
  process.exit(1);
}
' >/dev/null 2>&1; then
    return 0
  fi

  echo "$name must decode to 32 bytes (base64 or 64-char hex)" >&2
  exit 2
}

assert_encryption_key_list() {
  local name="$1"
  local value="${!name:-}"

  if [[ -z "$value" ]]; then
    return 0
  fi

  if KEY_LIST="$value" KEY_NAME="$name" node -e '
const raw = process.env.KEY_LIST || "";
const keyName = process.env.KEY_NAME || "encryption key list";
const entries = raw.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
if (!entries.length) {
  process.exit(1);
}
for (const entry of entries) {
  if (entry.toLowerCase().startsWith("replace-with-")) {
    process.exit(1);
  }
  const key = /^[0-9a-f]{64}$/i.test(entry) ? Buffer.from(entry, "hex") : Buffer.from(entry, "base64");
  if (key.length !== 32) {
    process.exit(1);
  }
}
' >/dev/null 2>&1; then
    return 0
  fi

  echo "$name must be a comma-separated list of 32-byte keys (base64 or 64-char hex)" >&2
  exit 2
}

is_truthy() {
  local value="${1:-}"
  local normalized
  normalized="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  [[ "$normalized" == "1" || "$normalized" == "true" || "$normalized" == "yes" || "$normalized" == "on" ]]
}

assert_email_like() {
  local name="$1"
  local value="${!name:-}"

  if [[ -z "$value" ]]; then
    echo "Missing required backend config in $BACKEND_ENV_FILE: $name" >&2
    exit 2
  fi

  if [[ ! "$value" =~ @ ]]; then
    echo "$name must contain an email address-like value" >&2
    exit 2
  fi
}

check_services_running() {
  local output
  output="$(docker compose ps --status running postgres redis)"

  if ! printf '%s' "$output" | grep -q 'store-postgres'; then
    echo "PostgreSQL container is not running (store-postgres)." >&2
    exit 1
  fi

  if ! printf '%s' "$output" | grep -q 'store-redis'; then
    echo "Redis container is not running (store-redis)." >&2
    exit 1
  fi
}

section "Toolchain"
require_cmd node
require_cmd pnpm
require_cmd docker
require_cmd curl

section "Environment"
ensure_env_file "$BACKEND_ENV_FILE" "$ROOT_DIR/apps/backend/.env.template"
ensure_env_file "$STOREFRONT_ENV_FILE" "$ROOT_DIR/apps/storefront/.env.example"
load_backend_env
BACKEND_SITE_ID="${SITE_ID:-}"
BACKEND_SITE_ENV="${SITE_ENV:-}"
load_storefront_env
STOREFRONT_SITE_ID="${NEXT_PUBLIC_SITE_ID:-${SITE_ID:-}}"
STOREFRONT_SITE_ENV="${NEXT_PUBLIC_SITE_ENV:-${SITE_ENV:-}}"
SITE_PROFILES_ROOT="$(resolve_site_profiles_root "$ROOT_DIR" "${SITE_PROFILES_ROOT:-}")"
assert_site_profile_env "$BACKEND_SITE_ID" "$BACKEND_SITE_ENV" "$STOREFRONT_SITE_ID" "$STOREFRONT_SITE_ENV" "$SITE_PROFILES_ROOT"
export SITE_ID="$BACKEND_SITE_ID"
export SITE_ENV="$BACKEND_SITE_ENV"
export NEXT_PUBLIC_SITE_ID="$STOREFRONT_SITE_ID"
export NEXT_PUBLIC_SITE_ENV="$STOREFRONT_SITE_ENV"
export SITE_PROFILES_ROOT
assert_backend_secret JWT_SECRET
assert_backend_secret COOKIE_SECRET
assert_backend_secret MANUAL_WEBHOOK_SECRET
assert_encryption_key CREDENTIAL_ENCRYPTION_KEY
assert_encryption_key_list CREDENTIAL_ENCRYPTION_KEY_PREVIOUS
assert_encryption_key DELIVERY_ENCRYPTION_KEY
assert_encryption_key_list DELIVERY_ENCRYPTION_KEY_PREVIOUS

if is_truthy "${RESEND_ENABLED:-false}"; then
  assert_backend_secret RESEND_API_KEY
  assert_email_like RESEND_FROM_EMAIL
fi

section "Infrastructure"
cd "$ROOT_DIR"
if [[ "$AUTO_START_SERVICES" == "1" ]]; then
  pnpm services:up
fi
check_services_running

if [[ "$MODE" == "quick" ]]; then
  echo "dev-check: quick checks passed"
  exit 0
fi

section "Build And Migration"
pnpm db:migrate
pnpm --dir apps/backend build
pnpm --dir apps/storefront lint
pnpm --dir apps/storefront build

if [[ "$MODE" == "full" ]]; then
  section "Tests"
  pnpm test
fi

if [[ "$RUN_LIVE" == "1" ]]; then
  section "Live Acceptance"
  pnpm acceptance:live
fi

echo "dev-check: ${MODE} checks passed"
