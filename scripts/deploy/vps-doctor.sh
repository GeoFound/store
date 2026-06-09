#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/store}"
APP_USER="${APP_USER:-store}"
BACKUP_DIR="${BACKUP_DIR:-$APP_ROOT/shared/backups}"
OUTPUT="${VPS_DOCTOR_OUTPUT:-}"
BACKEND_SERVICE="${BACKEND_SERVICE:-store-backend}"
STOREFRONT_SERVICE="${STOREFRONT_SERVICE:-store-storefront}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:9002/health}"
STOREFRONT_HEALTH_URL="${STOREFRONT_HEALTH_URL:-http://127.0.0.1:8000/api/health}"
ALLOW_APP_USER_DOCKER_ACCESS="${ALLOW_APP_USER_DOCKER_ACCESS:-0}"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 2
  fi
}

json_string() {
  jq -Rn --arg value "$1" '$value'
}

add_check() {
  local id="$1"
  local status="$2"
  local detail="$3"
  local evidence="${4:-}"

  printf '{"id":%s,"status":%s,"detail":%s,"evidence":%s}\n' \
    "$(json_string "$id")" \
    "$(json_string "$status")" \
    "$(json_string "$detail")" \
    "$(json_string "$evidence")" >> "$CHECKS_FILE"
}

is_truthy() {
  local normalized
  normalized="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  [[ "$normalized" == "1" || "$normalized" == "true" || "$normalized" == "yes" || "$normalized" == "on" ]]
}

systemd_status() {
  local unit="$1"

  if ! command -v systemctl >/dev/null 2>&1; then
    add_check "systemd.$unit" "warning" "systemctl is not available"
    return
  fi

  if systemctl is-active --quiet "$unit"; then
    add_check "systemd.$unit" "ok" "$unit is active"
  else
    add_check "systemd.$unit" "critical" "$unit is not active" "$(systemctl is-active "$unit" 2>/dev/null || true)"
  fi
}

systemd_user_check() {
  local unit="$1"
  local expected_user="$2"
  local actual_user

  if ! command -v systemctl >/dev/null 2>&1; then
    return
  fi

  actual_user="$(systemctl show -p User --value "$unit" 2>/dev/null || true)"

  if [[ "$actual_user" == "$expected_user" ]]; then
    add_check "systemd.$unit.user" "ok" "$unit runs as $expected_user"
  else
    add_check "systemd.$unit.user" "critical" "$unit must run as APP_USER for least privilege" "${actual_user:-root/default}"
  fi
}

http_status() {
  local id="$1"
  local url="$2"
  local code

  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url" || true)"

  if [[ "$code" =~ ^[23] ]]; then
    add_check "$id" "ok" "$url returned $code"
  else
    add_check "$id" "critical" "$url did not return a healthy status" "$code"
  fi
}

require_cmd jq
require_cmd curl

CHECKS_FILE="$(mktemp)"
trap 'rm -f "$CHECKS_FILE"' EXIT

systemd_status "$BACKEND_SERVICE"
systemd_status "$STOREFRONT_SERVICE"
systemd_status caddy
systemd_status docker
systemd_user_check "$BACKEND_SERVICE" "$APP_USER"
systemd_user_check "$STOREFRONT_SERVICE" "$APP_USER"

if id "$APP_USER" >/dev/null 2>&1; then
  app_uid="$(id -u "$APP_USER")"
  if [[ "$app_uid" == "0" ]]; then
    add_check "host.app-user" "critical" "APP_USER must not be root" "$APP_USER"
  else
    add_check "host.app-user" "ok" "APP_USER exists and is non-root" "$APP_USER:$app_uid"
  fi
else
  add_check "host.app-user" "critical" "APP_USER does not exist" "$APP_USER"
fi

http_status "health.backend" "$API_HEALTH_URL"
http_status "health.storefront" "$STOREFRONT_HEALTH_URL"

if command -v docker >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' | grep -qx 'store-postgres'; then
    add_check "docker.postgres" "ok" "store-postgres container is running"
  else
    add_check "docker.postgres" "critical" "store-postgres container is not running"
  fi

  if docker ps --format '{{.Names}}' | grep -qx 'store-redis'; then
    add_check "docker.redis" "ok" "store-redis container is running"
  else
    add_check "docker.redis" "critical" "store-redis container is not running"
  fi
fi

if [[ -e /var/run/docker.sock ]]; then
  socket_mode="$(stat -c '%a' /var/run/docker.sock 2>/dev/null || true)"
  socket_owner="$(stat -c '%U:%G' /var/run/docker.sock 2>/dev/null || true)"
  socket_evidence="$socket_mode $socket_owner"
  other_digit="${socket_mode: -1}"

  if [[ "$other_digit" =~ ^[0-7]$ ]] && (( other_digit & 2 )); then
    add_check "docker.socket.mode" "critical" "Docker socket is writable by others" "$socket_evidence"
  else
    add_check "docker.socket.mode" "ok" "Docker socket is not writable by others" "$socket_evidence"
  fi

  if id "$APP_USER" >/dev/null 2>&1 && id -nG "$APP_USER" | tr ' ' '\n' | grep -qx docker; then
    if is_truthy "$ALLOW_APP_USER_DOCKER_ACCESS"; then
      add_check "docker.socket.app-user" "warning" "APP_USER has docker group access by explicit override" "$APP_USER"
    else
      add_check "docker.socket.app-user" "critical" "APP_USER must not be in the docker group for least privilege" "$APP_USER"
    fi
  else
    add_check "docker.socket.app-user" "ok" "APP_USER does not have docker group access" "$APP_USER"
  fi
else
  add_check "docker.socket.mode" "warning" "Docker socket was not found"
fi

disk_pct="$(df -P "$APP_ROOT" 2>/dev/null | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
if [[ -n "$disk_pct" && "$disk_pct" =~ ^[0-9]+$ ]]; then
  if (( disk_pct >= 85 )); then
    add_check "host.disk" "critical" "Disk usage is high" "${disk_pct}%"
  elif (( disk_pct >= 75 )); then
    add_check "host.disk" "warning" "Disk usage is elevated" "${disk_pct}%"
  else
    add_check "host.disk" "ok" "Disk usage is acceptable" "${disk_pct}%"
  fi
else
  add_check "host.disk" "warning" "Unable to read disk usage for APP_ROOT" "$APP_ROOT"
fi

mem_available_mb="$(free -m 2>/dev/null | awk '/^Mem:/ {print $7}')"
if [[ -n "$mem_available_mb" && "$mem_available_mb" =~ ^[0-9]+$ ]]; then
  if (( mem_available_mb < 256 )); then
    add_check "host.memory" "critical" "Available memory is low" "${mem_available_mb} MiB"
  elif (( mem_available_mb < 512 )); then
    add_check "host.memory" "warning" "Available memory is limited" "${mem_available_mb} MiB"
  else
    add_check "host.memory" "ok" "Available memory is acceptable" "${mem_available_mb} MiB"
  fi
fi

latest_backup="$(
  if [[ -d "$BACKUP_DIR" ]]; then
    find "$BACKUP_DIR" -type f \( -name '*.dump' -o -name '*.dump.enc' \) -printf '%T@ %p\n' 2>/dev/null \
      | sort -nr \
      | awk 'NR==1 {$1=""; sub(/^ /, ""); print}'
  fi
)"
if [[ -n "$latest_backup" ]]; then
  add_check "backup.latest" "ok" "Latest PostgreSQL backup exists" "$latest_backup"
  if [[ "$latest_backup" == *.dump.enc ]]; then
    add_check "backup.encryption" "ok" "Latest PostgreSQL backup is encrypted" "$latest_backup"
  else
    add_check "backup.encryption" "critical" "Latest PostgreSQL backup is not encrypted" "$latest_backup"
  fi
else
  add_check "backup.latest" "critical" "No PostgreSQL backup dump or encrypted dump found" "$BACKUP_DIR"
  add_check "backup.encryption" "critical" "No encrypted PostgreSQL backup found" "$BACKUP_DIR"
fi

if command -v sshd >/dev/null 2>&1; then
  sshd_config="$(sshd -T 2>/dev/null || true)"
  if printf '%s\n' "$sshd_config" | grep -q '^permitrootlogin no$'; then
    add_check "ssh.root-login" "ok" "SSH root login is disabled"
  else
    add_check "ssh.root-login" "warning" "SSH root login is not confirmed disabled"
  fi

  if printf '%s\n' "$sshd_config" | grep -q '^passwordauthentication no$'; then
    add_check "ssh.password-auth" "ok" "SSH password auth is disabled"
  else
    add_check "ssh.password-auth" "warning" "SSH password auth is not confirmed disabled"
  fi
fi

if command -v ufw >/dev/null 2>&1; then
  ufw_status="$(ufw status 2>/dev/null | head -n 1 || true)"
  if printf '%s' "$ufw_status" | grep -qi 'active'; then
    add_check "firewall.ufw" "ok" "UFW is active"
  else
    add_check "firewall.ufw" "warning" "UFW is not active" "$ufw_status"
  fi
fi

if dpkg-query -W unattended-upgrades >/dev/null 2>&1; then
  add_check "updates.unattended-upgrades" "ok" "unattended-upgrades package is installed"
else
  add_check "updates.unattended-upgrades" "warning" "unattended-upgrades package is not installed"
fi

generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
report="$(
  jq -s \
    --arg generated_at "$generated_at" \
    --arg app_root "$APP_ROOT" \
    --arg app_user "$APP_USER" \
    --arg backup_dir "$BACKUP_DIR" \
    '{generated_at: $generated_at, app_root: $app_root, app_user: $app_user, backup_dir: $backup_dir, checks: .}' \
    "$CHECKS_FILE"
)"

if [[ -n "$OUTPUT" ]]; then
  install -d -m 0750 "$(dirname "$OUTPUT")"
  printf '%s\n' "$report" > "$OUTPUT"
else
  printf '%s\n' "$report"
fi
