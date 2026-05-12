#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
APP_ROOT="${APP_ROOT:-/opt/store}"
SERVICES_ENV_FILE="${SERVICES_ENV_FILE:-$APP_ROOT/shared/services.env}"

usage() {
  cat <<USAGE
usage: APP_ROOT=/opt/store bash scripts/deploy/services-up.sh

Starts PostgreSQL and Redis with production credentials loaded from:
  SERVICES_ENV_FILE (default: APP_ROOT/shared/services.env)
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ ! -f "$SERVICES_ENV_FILE" ]]; then
  echo "Services env file not found: $SERVICES_ENV_FILE" >&2
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Missing required command: docker" >&2
  exit 2
fi

set -a
# shellcheck disable=SC1090
source "$SERVICES_ENV_FILE"
set +a

if [[ -z "${POSTGRES_PASSWORD:-}" || "${POSTGRES_PASSWORD,,}" == replace-with-* ]]; then
  echo "POSTGRES_PASSWORD must be configured in $SERVICES_ENV_FILE" >&2
  exit 2
fi

if [[ -z "${REDIS_PASSWORD:-}" || "${REDIS_PASSWORD,,}" == replace-with-* ]]; then
  echo "REDIS_PASSWORD must be configured in $SERVICES_ENV_FILE" >&2
  exit 2
fi

cd "$ROOT_DIR"
docker compose --env-file "$SERVICES_ENV_FILE" up -d postgres redis

echo "services-up: ok"
