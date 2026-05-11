#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

APP_ROOT="${APP_ROOT:-/opt/store}"
APP_USER="${APP_USER:-store}"
APP_GROUP="${APP_GROUP:-$APP_USER}"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
START_NOW="${START_NOW:-0}"
PNPM_BIN="${PNPM_BIN:-$(command -v pnpm || true)}"

usage() {
  cat <<USAGE
usage: sudo APP_ROOT=/opt/store APP_USER=store START_NOW=0 bash scripts/deploy/install-systemd.sh

Installs store-backend and store-storefront unit files from ops/systemd templates.
Optional: set PNPM_BIN=/absolute/path/to/pnpm if pnpm is not on root PATH.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "$EUID" -ne 0 ]]; then
  echo "install-systemd.sh must run as root" >&2
  exit 2
fi

if [[ -z "$PNPM_BIN" ]]; then
  echo "pnpm binary not found. Install pnpm or set PNPM_BIN explicitly." >&2
  exit 2
fi

render_unit() {
  local src="$1"
  local dest="$2"

  sed \
    -e "s|__APP_ROOT__|$APP_ROOT|g" \
    -e "s|__APP_USER__|$APP_USER|g" \
    -e "s|__APP_GROUP__|$APP_GROUP|g" \
    -e "s|__PNPM_BIN__|$PNPM_BIN|g" \
    "$src" > "$dest"
}

render_unit "$REPO_ROOT/ops/systemd/store-backend.service.tpl" "$SYSTEMD_DIR/store-backend.service"
render_unit "$REPO_ROOT/ops/systemd/store-storefront.service.tpl" "$SYSTEMD_DIR/store-storefront.service"

systemctl daemon-reload
systemctl enable store-backend.service store-storefront.service

if [[ "$START_NOW" == "1" ]]; then
  systemctl restart store-backend.service store-storefront.service
fi

echo "install-systemd: ok"
