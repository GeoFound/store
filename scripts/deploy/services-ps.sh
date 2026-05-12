#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
APP_ROOT="${APP_ROOT:-/opt/store}"
SERVICES_ENV_FILE="${SERVICES_ENV_FILE:-$APP_ROOT/shared/services.env}"

if [[ ! -f "$SERVICES_ENV_FILE" ]]; then
  echo "Services env file not found: $SERVICES_ENV_FILE" >&2
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Missing required command: docker" >&2
  exit 2
fi

cd "$ROOT_DIR"
docker compose --env-file "$SERVICES_ENV_FILE" ps postgres redis
