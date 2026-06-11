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
assert(profile?.tenancy && typeof profile.tenancy === "object", "tenancy object is required")
assert(["dedicated", "pooled", "sharded"].includes(profile.tenancy.mode), "tenancy.mode must be one of: dedicated, pooled, sharded")
assert(["isolated", "shared", "sharded"].includes(profile.tenancy.data_plane), "tenancy.data_plane must be one of: isolated, shared, sharded")
assert(typeof profile.tenancy.control_plane === "string" && ["profile", "shared"].includes(profile.tenancy.control_plane), "tenancy.control_plane must be one of: profile, shared")
if (profile.tenancy.mode === "dedicated") {
  assert(profile.tenancy.data_plane === "isolated", "tenancy.mode=dedicated requires tenancy.data_plane=isolated")
}
if (profile.tenancy.mode === "pooled") {
  assert(profile.tenancy.data_plane === "shared", "tenancy.mode=pooled requires tenancy.data_plane=shared")
}
if (profile.tenancy.mode === "sharded") {
  assert(profile.tenancy.data_plane === "sharded", "tenancy.mode=sharded requires tenancy.data_plane=sharded")
}
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

if (profile.experience !== undefined) {
  assert(profile.experience && typeof profile.experience === "object" && !Array.isArray(profile.experience), "experience must be an object")

  if (profile.experience.personality !== undefined) {
    assert(Array.isArray(profile.experience.personality), "experience.personality must be an array")
  }

  if (profile.experience.guardrails !== undefined) {
    assert(Array.isArray(profile.experience.guardrails), "experience.guardrails must be an array")
  }

  if (profile.experience.pages !== undefined) {
    assert(profile.experience.pages && typeof profile.experience.pages === "object" && !Array.isArray(profile.experience.pages), "experience.pages must be an object")

    const allowedSectionTypes = new Set([
      "hero",
      "categories",
      "insights",
      "featured-products",
      "catalog-header",
      "catalog-controls",
      "product-grid",
      "product-media",
      "product-purchase",
      "product-details",
      "cart-items",
      "cart-summary",
      "checkout-form",
      "checkout-summary",
      "order-recovery",
      "content-list",
      "content-article",
      "account-auth",
      "account-overview",
      "password-reset",
      "support-assurance"
    ])

    for (const [pageKey, pageConfig] of Object.entries(profile.experience.pages)) {
      assert(pageConfig && typeof pageConfig === "object" && !Array.isArray(pageConfig), `experience.pages.${pageKey} must be an object`)

      const sections = pageConfig.sections
      if (sections !== undefined) {
        assert(Array.isArray(sections), `experience.pages.${pageKey}.sections must be an array`)

        for (const [index, section] of sections.entries()) {
          assert(section && typeof section === "object" && !Array.isArray(section), `experience.pages.${pageKey}.sections[${index}] must be an object`)
          assert(allowedSectionTypes.has(section.type), `experience.pages.${pageKey}.sections[${index}].type is invalid`)
          if (section.variant !== undefined) {
            assert(isNonEmptyString(section.variant), `experience.pages.${pageKey}.sections[${index}].variant must be a non-empty string`)
          }
        }
      }
    }
  }
}

process.stdout.write(`profile ok: ${profile.site.id}\n`)
NODE

(
  cd "$REPO_ROOT/apps/backend"
  TS_NODE_PROJECT=tsconfig.json pnpm exec ts-node \
    src/platform-adapters/validate-profile-config.ts \
    --profile "$PROFILE_FILE"
)

node "$REPO_ROOT/scripts/site/lifecycle.mjs" validate \
  --site-id "$SITE_ID" \
  --site-env "$SITE_ENV" \
  --profile-root "$PROFILE_ROOT" >/dev/null
