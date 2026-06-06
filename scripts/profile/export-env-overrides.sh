#!/usr/bin/env bash
set -euo pipefail

SITE_ID=""
SITE_ENV="${SITE_ENV:-production}"
TARGET="all"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROFILE_ROOT="${PROFILE_ROOT:-$REPO_ROOT/profiles/sites}"

usage() {
  cat <<USAGE
usage: scripts/profile/export-env-overrides.sh --site-id <id> [--site-env <env>] [--target backend|storefront|all]

Reads profiles/sites/<site-id>/<site-env>/site.json and prints env overrides.
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
    --target)
      TARGET="$2"
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

if [[ "$TARGET" != "backend" && "$TARGET" != "storefront" && "$TARGET" != "all" ]]; then
  echo "--target must be one of: backend, storefront, all" >&2
  exit 2
fi

PROFILE_FILE="$PROFILE_ROOT/$SITE_ID/$SITE_ENV/site.json"

if [[ ! -f "$PROFILE_FILE" ]]; then
  echo "Profile file not found: $PROFILE_FILE" >&2
  exit 2
fi

PROFILE_FILE="$PROFILE_FILE" SITE_ID="$SITE_ID" SITE_ENV="$SITE_ENV" TARGET="$TARGET" node <<'NODE'
const fs = require("node:fs")

const profilePath = process.env.PROFILE_FILE
const siteId = process.env.SITE_ID || ""
const siteEnv = process.env.SITE_ENV || "production"
const target = process.env.TARGET || "all"

const raw = fs.readFileSync(profilePath, "utf8")
const profile = JSON.parse(raw)

function toNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function toOrigin(value) {
  const text = toNonEmptyString(value)
  if (!text) {
    return ""
  }

  if (/^https?:\/\//i.test(text)) {
    return text
  }

  return `https://${text}`
}

function joinComma(values) {
  if (!Array.isArray(values)) {
    return ""
  }

  const normalized = Array.from(
    new Set(values.map((value) => toNonEmptyString(value)).filter(Boolean))
  )

  return normalized.join(",")
}

function toContractMapString(value) {
  if (!value || typeof value !== "object") {
    return ""
  }

  const entries = Object.entries(value)
    .map(([capability, names]) => {
      const normalizedCapability = toNonEmptyString(capability)
      const normalizedNames = joinComma(Array.isArray(names) ? names : [])

      if (!normalizedCapability || !normalizedNames) {
        return ""
      }

      return `${normalizedCapability}:${normalizedNames}`
    })
    .filter(Boolean)

  return entries.join(";")
}

function printLine(key, value) {
  process.stdout.write(`${key}=${value}\n`)
}

const resolvedSiteId =
  toNonEmptyString(profile?.site?.id) ||
  siteId

const storefrontOrigin =
  toOrigin(profile?.domains?.storefront) ||
  "https://example.com"
const apiOrigin =
  toOrigin(profile?.domains?.api) ||
  "https://api.example.com"

const enabledPlugins = joinComma(
  profile?.platform?.enabled_plugins || profile?.platform?.enabledPlugins
)
const disabledPlugins = joinComma(
  profile?.platform?.disabled_plugins || profile?.platform?.disabledPlugins
)
const enabledContracts = toContractMapString(
  profile?.platform?.enabled_contracts || profile?.platform?.enabledContracts
)
const disabledContracts = toContractMapString(
  profile?.platform?.disabled_contracts || profile?.platform?.disabledContracts
)

if (target === "backend" || target === "all") {
  printLine("SITE_ID", resolvedSiteId)
  printLine("SITE_ENV", siteEnv)
  printLine("STORE_CORS", storefrontOrigin)
  printLine("ADMIN_CORS", apiOrigin)
  printLine("AUTH_CORS", `${storefrontOrigin},${apiOrigin}`)
  printLine("PLATFORM_ENABLED_PLUGINS", enabledPlugins)
  printLine("PLATFORM_DISABLED_PLUGINS", disabledPlugins)
  printLine("PLATFORM_ENABLED_CONTRACTS", enabledContracts)
  printLine("PLATFORM_DISABLED_CONTRACTS", disabledContracts)
}

if (target === "storefront" || target === "all") {
  printLine("SITE_ID", resolvedSiteId)
  printLine("SITE_ENV", siteEnv)
  printLine("NEXT_PUBLIC_SITE_ID", resolvedSiteId)
  printLine("NEXT_PUBLIC_SITE_ENV", siteEnv)
  printLine("MEDUSA_BACKEND_URL", apiOrigin)
  printLine("NEXT_PUBLIC_MEDUSA_BACKEND_URL", apiOrigin)
  printLine("NEXT_PUBLIC_PLATFORM_ENABLED_PLUGINS", enabledPlugins)
  printLine("NEXT_PUBLIC_PLATFORM_DISABLED_PLUGINS", disabledPlugins)
}
NODE
