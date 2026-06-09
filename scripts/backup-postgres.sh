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
BACKUP_DIR="${BACKUP_DIR:-backups}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-store-postgres}"
POSTGRES_USER="${POSTGRES_USER:-store}"
POSTGRES_DB="${POSTGRES_DB:-store}"
BACKUP_ENCRYPTION_REQUIRED="${BACKUP_ENCRYPTION_REQUIRED:-0}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT="$BACKUP_DIR/store-$TIMESTAMP.dump"
TMP_OUTPUT="$BACKUP_DIR/.store-$TIMESTAMP.dump.tmp"

mkdir -p "$BACKUP_DIR"
docker exec "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$TMP_OUTPUT"
chmod 600 "$TMP_OUTPUT"

if [[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
  OUTPUT="$OUTPUT.enc"
  BACKUP_ENCRYPTION_KEY="$BACKUP_ENCRYPTION_KEY" \
    node "$SCRIPT_DIR/ops/backup-crypto.mjs" encrypt --in "$TMP_OUTPUT" --out "$OUTPUT"
  rm -f "$TMP_OUTPUT"
elif [[ "$BACKUP_ENCRYPTION_REQUIRED" == "1" || "$BACKUP_ENCRYPTION_REQUIRED" == "true" ]]; then
  rm -f "$TMP_OUTPUT"
  echo "BACKUP_ENCRYPTION_KEY is required when BACKUP_ENCRYPTION_REQUIRED=1" >&2
  exit 2
else
  mv "$TMP_OUTPUT" "$OUTPUT"
  chmod 600 "$OUTPUT"
fi

echo "$OUTPUT"
