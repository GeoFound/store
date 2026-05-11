#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

APP_ROOT="${APP_ROOT:-/opt/store}"
RELEASES_DIR="$APP_ROOT/releases"
CURRENT_LINK="$APP_ROOT/current"
LOCK_FILE="$APP_ROOT/deploy.lock"
SYSTEMD_SCOPE="${SYSTEMD_SCOPE:-system}"
BACKEND_SERVICE="${BACKEND_SERVICE:-store-backend}"
STOREFRONT_SERVICE="${STOREFRONT_SERVICE:-store-storefront}"
TARGET_RELEASE=""

usage() {
  cat <<USAGE
usage: scripts/deploy/rollback.sh [--to <release-id-or-absolute-path>]

Without --to, rollback switches to the previous release by timestamp order.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --to)
      if [[ $# -lt 2 ]]; then
        echo "--to requires a value" >&2
        exit 2
      fi
      TARGET_RELEASE="$2"
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

resolve_target_release() {
  local current_release
  current_release="$(readlink -f "$CURRENT_LINK")"

  if [[ -n "$TARGET_RELEASE" ]]; then
    if [[ "$TARGET_RELEASE" = /* ]]; then
      echo "$TARGET_RELEASE"
    else
      echo "$RELEASES_DIR/$TARGET_RELEASE"
    fi
    return
  fi

  mapfile -t releases < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d | sort)

  local idx
  for idx in "${!releases[@]}"; do
    if [[ "${releases[$idx]}" == "$current_release" ]]; then
      if (( idx == 0 )); then
        echo ""
      else
        echo "${releases[$((idx - 1))]}"
      fi
      return
    fi
  done

  echo ""
}

require_cmd readlink
require_cmd flock

if [[ ! -L "$CURRENT_LINK" && ! -d "$CURRENT_LINK" ]]; then
  echo "Current release link does not exist: $CURRENT_LINK" >&2
  exit 2
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another deployment or rollback is in progress." >&2
  exit 1
fi

resolved_target="$(resolve_target_release)"

if [[ -z "$resolved_target" ]]; then
  echo "No rollback target could be determined." >&2
  exit 1
fi

if [[ ! -d "$resolved_target" ]]; then
  echo "Rollback target not found: $resolved_target" >&2
  exit 2
fi

echo "Rolling back current release to $(basename "$resolved_target")"
ln -sfn "$resolved_target" "$CURRENT_LINK"

restart_services
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:9002/health}" \
STOREFRONT_HEALTH_URL="${STOREFRONT_HEALTH_URL:-http://127.0.0.1:8000/api/health}" \
  bash "$REPO_ROOT/scripts/deploy/health-gate.sh"

echo "rollback: ok"
echo "release_id=$(basename "$resolved_target")"
