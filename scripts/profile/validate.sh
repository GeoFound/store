#!/usr/bin/env bash
set -euo pipefail

SITE_ID=""
SITE_ENV="${SITE_ENV:-production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROFILE_ROOT="${PROFILE_ROOT:-$REPO_ROOT/profiles/sites}"

usage() {
  cat <<USAGE
usage: scripts/profile/validate.sh --site-id <id> [--site-env <env>]

Validates profiles/sites/<site-id>/<site-env>/site.json
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      shift
      continue
      ;;
    --site-id)
      SITE_ID="$2"
      shift 2
      ;;
    --site-env)
      SITE_ENV="$2"
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

if [[ -z "$SITE_ID" ]]; then
  echo "--site-id is required" >&2
  exit 2
fi

PROFILE_FILE="$PROFILE_ROOT/$SITE_ID/$SITE_ENV/site.json"

if [[ ! -f "$PROFILE_FILE" ]]; then
  echo "Profile file not found: $PROFILE_FILE" >&2
  exit 2
fi

PROFILE_FILE="$PROFILE_FILE" SITE_ID="$SITE_ID" node <<'NODE'
const fs = require("node:fs")

const profilePath = process.env.PROFILE_FILE
const expectedSiteId = process.env.SITE_ID || ""

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}

const raw = fs.readFileSync(profilePath, "utf8")
const profile = JSON.parse(raw)

assert(profile && typeof profile === "object", "Profile must be a JSON object")
assert(isNonEmptyString(profile?.site?.id), "site.id is required")
assert(profile.site.id === expectedSiteId, `site.id mismatch: expected ${expectedSiteId}, got ${profile.site.id}`)
assert(isNonEmptyString(profile?.site?.name), "site.name is required")
assert(isNonEmptyString(profile?.site?.description), "site.description is required")
assert(isNonEmptyString(profile?.domains?.storefront), "domains.storefront is required")
assert(isNonEmptyString(profile?.domains?.api), "domains.api is required")
assert(profile?.theme && typeof profile.theme === "object", "theme object is required")
assert(profile?.content && typeof profile.content === "object", "content object is required")
assert(profile?.platform && typeof profile.platform === "object", "platform object is required")
assert(isNonEmptyString(profile.theme.background), "theme.background is required")
assert(isNonEmptyString(profile.theme.foreground), "theme.foreground is required")
assert(isNonEmptyString(profile.theme.accent), "theme.accent is required")

if (profile.content?.home?.announcements !== undefined) {
  assert(Array.isArray(profile.content.home.announcements), "content.home.announcements must be an array")

  for (const [index, announcement] of profile.content.home.announcements.entries()) {
    assert(isNonEmptyString(announcement?.title), `content.home.announcements[${index}].title is required`)
    assert(isNonEmptyString(announcement?.body), `content.home.announcements[${index}].body is required`)
  }
}

if (profile.content?.categories?.links !== undefined) {
  assert(Array.isArray(profile.content.categories.links), "content.categories.links must be an array")

  for (const [index, link] of profile.content.categories.links.entries()) {
    assert(isNonEmptyString(link?.label), `content.categories.links[${index}].label is required`)
    assert(isNonEmptyString(link?.href), `content.categories.links[${index}].href is required`)
  }
}

process.stdout.write(`profile ok: ${profile.site.id}\n`)
NODE
