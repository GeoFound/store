#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
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
assert_backend_secret JWT_SECRET
assert_backend_secret COOKIE_SECRET
assert_backend_secret MANUAL_WEBHOOK_SECRET

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
