#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROFILE_ROOT="${PROFILE_ROOT:-$REPO_ROOT/profiles/sites}"

if [[ ! -d "$PROFILE_ROOT" ]]; then
  echo "Profile root not found: $PROFILE_ROOT" >&2
  exit 2
fi

status=0

while IFS= read -r sitePath; do
  siteId="$(basename "$sitePath")"

  while IFS= read -r envPath; do
    siteEnv="$(basename "$envPath")"

    if ! bash "$REPO_ROOT/scripts/profile/validate.sh" --site-id "$siteId" --site-env "$siteEnv"; then
      status=1
    fi
  done < <(find "$sitePath" -mindepth 1 -maxdepth 1 -type d | sort)
done < <(find "$PROFILE_ROOT" -mindepth 1 -maxdepth 1 -type d | sort)

exit "$status"
