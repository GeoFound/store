#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-}"
if [[ -z "$BACKUP_ENV_FILE" && -f /opt/store/shared/ops.env ]]; then
  BACKUP_ENV_FILE="/opt/store/shared/ops.env"
fi
if [[ -n "$BACKUP_ENV_FILE" && -f "$BACKUP_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$BACKUP_ENV_FILE"
  set +a
fi

if [ "$#" -ne 1 ]; then
  echo "usage: scripts/restore-postgres.sh backups/store-YYYYMMDDTHHMMSSZ.dump" >&2
  exit 2
fi

BACKUP_FILE="$1"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-store-postgres}"
POSTGRES_USER="${POSTGRES_USER:-store}"
POSTGRES_DB="${POSTGRES_DB:-store}"
RESTORE_ALLOW_PRODUCTION_CONTAINER="${RESTORE_ALLOW_PRODUCTION_CONTAINER:-0}"
RESTORE_DROP_DATABASE="${RESTORE_DROP_DATABASE:-1}"
RESTORE_INPUT="$BACKUP_FILE"
DECRYPTED_TMP=""

if [ ! -f "$BACKUP_FILE" ]; then
  echo "backup file not found: $BACKUP_FILE" >&2
  exit 2
fi

if [[ "$POSTGRES_CONTAINER" == "store-postgres" && "$RESTORE_ALLOW_PRODUCTION_CONTAINER" != "1" ]]; then
  echo "Refusing to restore into store-postgres without RESTORE_ALLOW_PRODUCTION_CONTAINER=1" >&2
  exit 2
fi

cleanup() {
  if [[ -n "$DECRYPTED_TMP" ]]; then
    rm -f "$DECRYPTED_TMP"
  fi
}
trap cleanup EXIT

if [[ "$BACKUP_FILE" == *.enc ]]; then
  DECRYPTED_TMP="$(mktemp)"
  BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}" \
    node "$SCRIPT_DIR/ops/backup-crypto.mjs" decrypt --in "$BACKUP_FILE" --out "$DECRYPTED_TMP"
  RESTORE_INPUT="$DECRYPTED_TMP"
fi

if [[ "$RESTORE_DROP_DATABASE" == "1" || "$RESTORE_DROP_DATABASE" == "true" ]]; then
  docker exec "$POSTGRES_CONTAINER" dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB"
  docker exec "$POSTGRES_CONTAINER" createdb -U "$POSTGRES_USER" "$POSTGRES_DB"
fi

docker exec -i "$POSTGRES_CONTAINER" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < "$RESTORE_INPUT"

echo "restore-postgres: ok"
