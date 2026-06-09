#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-/opt/store/shared/backend.env}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-store-postgres}"
POSTGRES_USER="${POSTGRES_USER:-store}"
POSTGRES_DB="${POSTGRES_DB:-store}"
ROTATION_APPLY="${ROTATION_APPLY:-0}"
ROTATION_LIMIT="${ROTATION_LIMIT:-0}"

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

load_backend_env() {
  if [[ -f "$BACKEND_ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$BACKEND_ENV_FILE"
    set +a
  fi
}

json_string() {
  jq -Rn --arg value "$1" '$value'
}

psql_query() {
  docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F $'\t' "$@"
}

table_exists() {
  local table="$1"
  local exists
  exists="$(psql_query -c "select to_regclass('public.$table') is not null;")"
  [[ "$exists" == "t" ]]
}

rotate_table() {
  local table="$1"
  local column="$2"
  local primary="$3"
  local previous="$4"
  local where_clause="$5"
  local processed=0
  local changed=0
  local failed=0
  local limit_sql=""

  if ! table_exists "$table"; then
    printf '{"table":%s,"column":%s,"processed":0,"changed":0,"failed":0,"skipped":"missing_table"}\n' \
      "$(json_string "$table")" \
      "$(json_string "$column")"
    return
  fi

  if [[ "$ROTATION_LIMIT" =~ ^[0-9]+$ && "$ROTATION_LIMIT" -gt 0 ]]; then
    limit_sql=" limit $ROTATION_LIMIT"
  fi

  while IFS=$'\t' read -r id blob; do
    if [[ -z "$id" || -z "$blob" ]]; then
      continue
    fi

    processed=$((processed + 1))

    if ! new_blob="$(printf '%s' "$blob" | node "$REPO_ROOT/scripts/ops/reencrypt-payload.mjs" --primary "$primary" --previous "$previous")"; then
      failed=$((failed + 1))
      continue
    fi

    if [[ "$new_blob" != "$blob" ]]; then
      changed=$((changed + 1))
    fi

    if is_truthy "$ROTATION_APPLY"; then
      printf '%s' "$new_blob" | docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        -v "row_id=$id" \
        -v "payload=$new_blob" \
        -c "update $table set $column = :'payload', updated_at = now() where id = :'row_id';" >/dev/null
    fi
  done < <(psql_query -c "select id, $column from $table where $column is not null $where_clause order by id$limit_sql;")

  printf '{"table":%s,"column":%s,"processed":%s,"changed":%s,"failed":%s,"applied":%s}\n' \
    "$(json_string "$table")" \
    "$(json_string "$column")" \
    "$processed" \
    "$changed" \
    "$failed" \
    "$(is_truthy "$ROTATION_APPLY" && echo true || echo false)"
}

require_cmd docker
require_cmd jq
require_cmd node

load_backend_env

CHECKS_FILE="$(mktemp)"
trap 'rm -f "$CHECKS_FILE"' EXIT

rotate_table "account_item" "credential_blob" "CREDENTIAL_ENCRYPTION_KEY" "CREDENTIAL_ENCRYPTION_KEY_PREVIOUS" "and deleted_at is null" >> "$CHECKS_FILE"
rotate_table "order_delivery" "delivery_payload_encrypted" "DELIVERY_ENCRYPTION_KEY" "DELIVERY_ENCRYPTION_KEY_PREVIOUS,CREDENTIAL_ENCRYPTION_KEY_PREVIOUS" "and deleted_at is null" >> "$CHECKS_FILE"
rotate_table "supplier_procurement_order" "fulfillment_payload_encrypted" "SUPPLIER_ENCRYPTION_KEY" "SUPPLIER_ENCRYPTION_KEY_PREVIOUS,DELIVERY_ENCRYPTION_KEY_PREVIOUS" "and deleted_at is null" >> "$CHECKS_FILE"

report="$(jq -s \
  --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg backend_env_file "$BACKEND_ENV_FILE" \
  --argjson applied "$(is_truthy "$ROTATION_APPLY" && echo true || echo false)" \
  '{generated_at:$generated_at, backend_env_file:$backend_env_file, applied:$applied, tables:.}' \
  "$CHECKS_FILE")"
printf '%s\n' "$report"

failed_total="$(jq -s 'map(.failed // 0) | add' "$CHECKS_FILE")"
if [[ "$failed_total" =~ ^[0-9]+$ && "$failed_total" -gt 0 ]]; then
  exit 1
fi
