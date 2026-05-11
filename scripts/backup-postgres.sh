#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT="$BACKUP_DIR/store-$TIMESTAMP.dump"

mkdir -p "$BACKUP_DIR"
docker exec store-postgres pg_dump -U store -d store -Fc > "$OUTPUT"

echo "$OUTPUT"
