#!/usr/bin/env bash

resolve_site_profiles_root() {
  local repo_root="$1"
  local raw="${2:-}"
  local candidate

  if [[ -z "$raw" ]]; then
    printf '%s' "$repo_root/profiles/sites"
    return 0
  fi

  if [[ "$raw" = /* ]]; then
    printf '%s' "$raw"
    return 0
  fi

  for candidate in "$repo_root/$raw" "$repo_root/apps/storefront/$raw"; do
    if [[ -d "$candidate" ]]; then
      (cd "$candidate" && pwd)
      return 0
    fi
  done

  printf '%s' "$repo_root/$raw"
}

assert_site_profile_env_match() {
  local backend_site_id="$1"
  local backend_site_env="$2"
  local storefront_site_id="$3"
  local storefront_site_env="$4"

  if [[ "$backend_site_id" != "$storefront_site_id" || "$backend_site_env" != "$storefront_site_env" ]]; then
    echo "Backend/storefront site profile mismatch: backend=$backend_site_id/$backend_site_env storefront=$storefront_site_id/$storefront_site_env" >&2
    return 2
  fi
}

validate_site_profile() {
  local site_id="$1"
  local site_env="$2"
  local profiles_root="$3"

  PROFILE_ROOT="$profiles_root" pnpm profile:validate -- --site-id "$site_id" --site-env "$site_env"
}
