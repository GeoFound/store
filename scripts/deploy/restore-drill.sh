#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 1 ]]; then
  echo "usage: scripts/deploy/restore-drill.sh backups/store-YYYYMMDDTHHMMSSZ.dump[.enc]" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_FILE="$1"
RESTORE_DRILL_POSTGRES_IMAGE="${RESTORE_DRILL_POSTGRES_IMAGE:-postgres:16-alpine}"
RESTORE_DRILL_CONTAINER="${RESTORE_DRILL_CONTAINER:-store-restore-drill-$(date -u +%Y%m%d%H%M%S)-$$}"
RESTORE_DRILL_KEEP_CONTAINER="${RESTORE_DRILL_KEEP_CONTAINER:-0}"
RESTORE_DRILL_TIMEOUT_SECONDS="${RESTORE_DRILL_TIMEOUT_SECONDS:-60}"
POSTGRES_USER="${POSTGRES_USER:-store}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-store_restore_drill}"
POSTGRES_DB="${POSTGRES_DB:-store}"

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

cleanup() {
  if ! is_truthy "$RESTORE_DRILL_KEEP_CONTAINER"; then
    docker rm -f "$RESTORE_DRILL_CONTAINER" >/dev/null 2>&1 || true
  fi
}

require_cmd docker

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "backup file not found: $BACKUP_FILE" >&2
  exit 2
fi

trap cleanup EXIT

docker run -d \
  --name "$RESTORE_DRILL_CONTAINER" \
  -e "POSTGRES_USER=$POSTGRES_USER" \
  -e "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" \
  -e "POSTGRES_DB=$POSTGRES_DB" \
  "$RESTORE_DRILL_POSTGRES_IMAGE" >/dev/null

deadline=$((SECONDS + RESTORE_DRILL_TIMEOUT_SECONDS))
until docker exec "$RESTORE_DRILL_CONTAINER" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  if (( SECONDS >= deadline )); then
    echo "restore drill postgres did not become ready" >&2
    exit 1
  fi
  sleep 1
done

POSTGRES_CONTAINER="$RESTORE_DRILL_CONTAINER" \
POSTGRES_USER="$POSTGRES_USER" \
POSTGRES_DB="$POSTGRES_DB" \
RESTORE_ALLOW_PRODUCTION_CONTAINER=1 \
bash "$REPO_ROOT/scripts/restore-postgres.sh" "$BACKUP_FILE" >/dev/null

table_count="$(
  docker exec "$RESTORE_DRILL_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At \
    -c "select count(*) from information_schema.tables where table_schema = 'public';"
)"

if [[ -z "$table_count" || ! "$table_count" =~ ^[0-9]+$ || "$table_count" -eq 0 ]]; then
  echo "restore drill completed but restored database has no public tables" >&2
  exit 1
fi

printf '{"ok":true,"container":"%s","table_count":%s,"backup_file":"%s","generated_at":"%s"}\n' \
  "$RESTORE_DRILL_CONTAINER" \
  "$table_count" \
  "$BACKUP_FILE" \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
