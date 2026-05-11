#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

APP_ROOT="${APP_ROOT:-/opt/store}"
RELEASES_DIR="$APP_ROOT/releases"
SHARED_DIR="$APP_ROOT/shared"
CURRENT_LINK="$APP_ROOT/current"
LOCK_FILE="$APP_ROOT/deploy.lock"
PNPM_STORE_PATH="${PNPM_STORE_PATH:-$SHARED_DIR/pnpm-store}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$SHARED_DIR/backend.env}"
STOREFRONT_ENV_FILE="${STOREFRONT_ENV_FILE:-$SHARED_DIR/storefront.env}"
KEEP_RELEASES="${KEEP_RELEASES:-8}"
REMOTE_NAME="${REMOTE_NAME:-origin}"
DEFAULT_REF="${DEFAULT_REF:-origin/main}"
REF=""
RUN_DB_MIGRATIONS="${RUN_DB_MIGRATIONS:-1}"
POST_DEPLOY_CHECK_COMMAND="${POST_DEPLOY_CHECK_COMMAND:-}"
SYSTEMD_SCOPE="${SYSTEMD_SCOPE:-system}"
BACKEND_SERVICE="${BACKEND_SERVICE:-store-backend}"
STOREFRONT_SERVICE="${STOREFRONT_SERVICE:-store-storefront}"

new_release=""
previous_release=""
switched_current="0"

usage() {
  cat <<USAGE
usage: scripts/deploy/deploy.sh [--ref <git-ref>] [--keep-releases <count>]

Environment:
  APP_ROOT                      Deployment root (default: /opt/store)
  BACKEND_ENV_FILE              Backend env file path (default: APP_ROOT/shared/backend.env)
  STOREFRONT_ENV_FILE           Storefront env file path (default: APP_ROOT/shared/storefront.env)
  RUN_DB_MIGRATIONS             1 to run migrations (default), 0 to skip
  POST_DEPLOY_CHECK_COMMAND     Optional post-deploy verification command
  SYSTEMD_SCOPE                 system or user (default: system)
  BACKEND_SERVICE               Backend systemd unit name (default: store-backend)
  STOREFRONT_SERVICE            Storefront systemd unit name (default: store-storefront)
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      if [[ $# -lt 2 ]]; then
        echo "--ref requires a value" >&2
        exit 2
      fi
      REF="$2"
      shift 2
      ;;
    --keep-releases)
      if [[ $# -lt 2 ]]; then
        echo "--keep-releases requires a value" >&2
        exit 2
      fi
      KEEP_RELEASES="$2"
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

if [[ -z "$REF" ]]; then
  REF="$DEFAULT_REF"
fi

if ! [[ "$KEEP_RELEASES" =~ ^[0-9]+$ ]] || (( KEEP_RELEASES < 2 )); then
  echo "--keep-releases must be an integer >= 2" >&2
  exit 2
fi

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 2
  fi
}

systemctl_run() {
  if [[ "$SYSTEMD_SCOPE" == "user" ]]; then
    systemctl --user "$@"
  else
    sudo systemctl "$@"
  fi
}

restart_services() {
  systemctl_run daemon-reload
  systemctl_run restart "$BACKEND_SERVICE" "$STOREFRONT_SERVICE"
}

cleanup_old_releases() {
  mapfile -t releases < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d | sort)

  if (( ${#releases[@]} <= KEEP_RELEASES )); then
    return 0
  fi

  local prune_count=$(( ${#releases[@]} - KEEP_RELEASES ))
  local i

  for ((i = 0; i < prune_count; i++)); do
    local candidate="${releases[$i]}"

    if [[ "$candidate" == "$new_release" || "$candidate" == "$previous_release" ]]; then
      continue
    fi

    rm -rf "$candidate"
  done
}

on_error() {
  local exit_code="$?"

  if [[ "$switched_current" == "1" && -n "$previous_release" && -d "$previous_release" ]]; then
    echo "Deployment failed, rolling back to previous release: $(basename "$previous_release")" >&2
    ln -sfn "$previous_release" "$CURRENT_LINK"
    restart_services || true
    BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:9002/health}" \
    STOREFRONT_HEALTH_URL="${STOREFRONT_HEALTH_URL:-http://127.0.0.1:8000/api/health}" \
      bash "$REPO_ROOT/scripts/deploy/health-gate.sh" || true
  fi

  if [[ "$switched_current" == "0" && -n "$new_release" && -d "$new_release" ]]; then
    rm -rf "$new_release"
  fi

  exit "$exit_code"
}

trap on_error ERR

require_cmd git
require_cmd pnpm
require_cmd tar
require_cmd flock
require_cmd readlink

if [[ ! -d "$RELEASES_DIR" || ! -d "$SHARED_DIR" ]]; then
  echo "Deployment directories are missing under $APP_ROOT. Run scripts/deploy/bootstrap-vps.sh first." >&2
  exit 2
fi

if [[ ! -f "$BACKEND_ENV_FILE" ]]; then
  echo "Backend env file not found: $BACKEND_ENV_FILE" >&2
  exit 2
fi

if [[ ! -f "$STOREFRONT_ENV_FILE" ]]; then
  echo "Storefront env file not found: $STOREFRONT_ENV_FILE" >&2
  exit 2
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another deployment is in progress." >&2
  exit 1
fi

cd "$REPO_ROOT"

git fetch --prune "$REMOTE_NAME"
if git rev-parse --verify "${REF}^{commit}" >/dev/null 2>&1; then
  commit_sha="$(git rev-parse --verify "${REF}^{commit}")"
elif [[ "$REF" != */* ]] && git rev-parse --verify "${REMOTE_NAME}/${REF}^{commit}" >/dev/null 2>&1; then
  REF="${REMOTE_NAME}/${REF}"
  commit_sha="$(git rev-parse --verify "${REF}^{commit}")"
else
  echo "Unable to resolve ref '$REF' to a commit." >&2
  exit 2
fi

short_sha="$(git rev-parse --short "$commit_sha")"
release_id="$(date -u +%Y%m%dT%H%M%SZ)-$short_sha"
new_release="$RELEASES_DIR/$release_id"

if [[ -L "$CURRENT_LINK" ]]; then
  previous_release="$(readlink -f "$CURRENT_LINK")"
elif [[ -d "$CURRENT_LINK" ]]; then
  previous_release="$(readlink -f "$CURRENT_LINK")"
else
  previous_release=""
fi

echo "Preparing release $release_id ($commit_sha)"
mkdir -p "$new_release" "$PNPM_STORE_PATH"
git archive "$commit_sha" | tar -x -C "$new_release"

ln -sfn "$BACKEND_ENV_FILE" "$new_release/apps/backend/.env"
ln -sfn "$STOREFRONT_ENV_FILE" "$new_release/apps/storefront/.env.local"

(
  cd "$new_release"
  PNPM_STORE_PATH="$PNPM_STORE_PATH" pnpm install --frozen-lockfile
  PNPM_STORE_PATH="$PNPM_STORE_PATH" pnpm --dir apps/backend build
  PNPM_STORE_PATH="$PNPM_STORE_PATH" pnpm --dir apps/storefront build

  if [[ "$RUN_DB_MIGRATIONS" == "1" ]]; then
    PNPM_STORE_PATH="$PNPM_STORE_PATH" pnpm db:migrate
  fi
)

echo "Switching current symlink -> $release_id"
ln -sfn "$new_release" "$CURRENT_LINK"
switched_current="1"

restart_services
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:9002/health}" \
STOREFRONT_HEALTH_URL="${STOREFRONT_HEALTH_URL:-http://127.0.0.1:8000/api/health}" \
  bash "$REPO_ROOT/scripts/deploy/health-gate.sh"

if [[ -n "$POST_DEPLOY_CHECK_COMMAND" ]]; then
  echo "Running post deploy checks..."
  (
    cd "$CURRENT_LINK"
    eval "$POST_DEPLOY_CHECK_COMMAND"
  )
fi

cleanup_old_releases

echo "deploy: ok"
echo "release_id=$release_id"
echo "commit_sha=$commit_sha"
