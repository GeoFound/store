#!/usr/bin/env bash
set -euo pipefail

SITE_ID=""
SITE_ENV="${SITE_ENV:-production}"
BACKEND_BASE_FILE=""
STOREFRONT_BASE_FILE=""
SERVICES_BASE_FILE=""
OUTPUT_DIR=""

usage() {
  cat <<USAGE
usage: scripts/profile/prepare-env-files.sh --site-id <id> --site-env <env> --backend-base-file <path> --storefront-base-file <path> [--services-base-file <path>] --output-dir <dir>

Copies base env files and appends profile-driven overrides.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --site-id)
      SITE_ID="$2"
      shift 2
      ;;
    --site-env)
      SITE_ENV="$2"
      shift 2
      ;;
    --backend-base-file)
      BACKEND_BASE_FILE="$2"
      shift 2
      ;;
    --storefront-base-file)
      STOREFRONT_BASE_FILE="$2"
      shift 2
      ;;
    --services-base-file)
      SERVICES_BASE_FILE="$2"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
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

if [[ -z "$SITE_ID" || -z "$BACKEND_BASE_FILE" || -z "$STOREFRONT_BASE_FILE" || -z "$OUTPUT_DIR" ]]; then
  echo "Missing required arguments" >&2
  usage
  exit 2
fi

if [[ ! -f "$BACKEND_BASE_FILE" ]]; then
  echo "Backend base env file not found: $BACKEND_BASE_FILE" >&2
  exit 2
fi

if [[ ! -f "$STOREFRONT_BASE_FILE" ]]; then
  echo "Storefront base env file not found: $STOREFRONT_BASE_FILE" >&2
  exit 2
fi

if [[ -n "$SERVICES_BASE_FILE" && ! -f "$SERVICES_BASE_FILE" ]]; then
  echo "Services base env file not found: $SERVICES_BASE_FILE" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

mkdir -p "$OUTPUT_DIR"

cp "$BACKEND_BASE_FILE" "$OUTPUT_DIR/backend.env"
printf '\n' >> "$OUTPUT_DIR/backend.env"
"$REPO_ROOT/scripts/profile/export-env-overrides.sh" \
  --site-id "$SITE_ID" \
  --site-env "$SITE_ENV" \
  --target backend >> "$OUTPUT_DIR/backend.env"

cp "$STOREFRONT_BASE_FILE" "$OUTPUT_DIR/storefront.env"
printf '\n' >> "$OUTPUT_DIR/storefront.env"
"$REPO_ROOT/scripts/profile/export-env-overrides.sh" \
  --site-id "$SITE_ID" \
  --site-env "$SITE_ENV" \
  --target storefront >> "$OUTPUT_DIR/storefront.env"

if [[ -n "$SERVICES_BASE_FILE" ]]; then
  cp "$SERVICES_BASE_FILE" "$OUTPUT_DIR/services.env"
fi

echo "prepared env files for site=$SITE_ID env=$SITE_ENV at $OUTPUT_DIR"
