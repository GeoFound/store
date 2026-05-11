#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: scripts/restore-postgres.sh backups/store-YYYYMMDDTHHMMSSZ.dump" >&2
  exit 2
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "backup file not found: $BACKUP_FILE" >&2
  exit 2
fi

docker exec store-postgres dropdb -U store --if-exists store
docker exec store-postgres createdb -U store store
docker exec -i store-postgres pg_restore -U store -d store --clean --if-exists < "$BACKUP_FILE"

echo "restore-postgres: ok"
