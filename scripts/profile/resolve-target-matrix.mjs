#!/usr/bin/env node
import fs from "node:fs"

function parseArgs(argv) {
  const result = {
    siteEnv: "production",
    targets: "all",
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--site-env") {
      result.siteEnv = String(argv[index + 1] || "").trim() || "production"
      index += 1
      continue
    }

    if (arg === "--targets") {
      result.targets = String(argv[index + 1] || "").trim() || "all"
      index += 1
      continue
    }

    if (arg === "-h" || arg === "--help") {
      process.stdout.write(
        "usage: node scripts/profile/resolve-target-matrix.mjs --site-env <env> --targets <all|site1,site2>\n"
      )
      process.exit(0)
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return result
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : ""
}

function assertTargetShape(target) {
  const required = [
    "site_id",
    "site_env",
    "github_environment",
    "deploy_host_secret",
    "deploy_user_secret",
    "deploy_key_secret",
    "deploy_host_key_secret",
    "deploy_repo_path_secret",
    "app_root_secret",
    "backend_env_secret",
    "storefront_env_secret",
    "services_env_secret",
  ]

  for (const key of required) {
    if (!normalizeString(target?.[key])) {
      throw new Error(`Target ${target?.site_id || "unknown"} missing required key: ${key}`)
    }
  }
}

function resolveMatrix({ siteEnv, targets }) {
  const raw = fs.readFileSync("profiles/targets.json", "utf8")
  const parsed = JSON.parse(raw)
  const allTargets = Array.isArray(parsed.targets) ? parsed.targets : []
  const requested =
    targets.toLowerCase() === "all"
      ? null
      : new Set(
          targets
            .split(",")
            .map((entry) => normalizeString(entry))
            .filter(Boolean)
        )

  const selected = allTargets.filter((target) => {
    if (!target || typeof target !== "object" || !target.enabled) {
      return false
    }

    if (normalizeString(target.site_env) !== siteEnv) {
      return false
    }

    if (!requested) {
      return true
    }

    return requested.has(normalizeString(target.site_id))
  })

  if (!selected.length) {
    throw new Error(
      `No enabled deployment targets matched site_env=${siteEnv} targets=${targets}`
    )
  }

  selected.forEach(assertTargetShape)

  return {
    include: selected,
  }
}

try {
  const args = parseArgs(process.argv.slice(2))
  const matrix = resolveMatrix(args)
  process.stdout.write(JSON.stringify(matrix))
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  )
  process.exit(1)
}
