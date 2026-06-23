import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"))
}

function normalizePath(value) {
  return value.split(path.sep).join("/")
}

function listFiles(relativeDir, predicate) {
  const absoluteDir = path.join(root, relativeDir)

  if (!fs.existsSync(absoluteDir)) {
    return []
  }

  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = normalizePath(path.join(relativeDir, entry.name))

    if (entry.isDirectory()) {
      return listFiles(relativePath, predicate)
    }

    return entry.isFile() && predicate(relativePath) ? [relativePath] : []
  })
}

function listDirectories(relativeDir, depth) {
  const absoluteDir = path.join(root, relativeDir)

  if (!fs.existsSync(absoluteDir)) {
    return []
  }

  if (depth === 0) {
    return [relativeDir]
  }

  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) {
      return []
    }

    const relativePath = normalizePath(path.join(relativeDir, entry.name))
    return listDirectories(relativePath, depth - 1)
  })
}

function trackedValue(entry) {
  if (typeof entry === "string") {
    return entry
  }

  return entry?.path || entry?.name || entry?.value || ""
}

function validateTrackedEntry(type, entry, issues) {
  const value = trackedValue(entry)

  if (!value) {
    issues.push({
      id: "inventory-baseline.entry-value-missing",
      type,
      message: "Inventory baseline entry must declare path, name, or value.",
    })
    return value
  }

  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    issues.push({
      id: "inventory-baseline.entry-metadata-missing",
      type,
      value,
      message:
        "Inventory baseline entries must be objects with owner and verification metadata.",
    })
    return value
  }

  if (!entry.owner) {
    issues.push({
      id: "inventory-baseline.entry-owner-missing",
      type,
      value,
      message: "Inventory baseline entry must declare owner.",
    })
  }

  if (!Array.isArray(entry.verification) || entry.verification.length === 0) {
    issues.push({
      id: "inventory-baseline.entry-verification-missing",
      type,
      value,
      message: "Inventory baseline entry must declare verification commands.",
    })
  }

  return value
}

function compareTrackedList(type, current, baseline, issues, warnings) {
  const currentSet = new Set(current)
  const baselineValues = baseline.map((entry) => validateTrackedEntry(type, entry, issues))
  const baselineSet = new Set(baselineValues)

  for (const value of current) {
    if (!baselineSet.has(value)) {
      issues.push({
        id: "inventory.untracked-entity",
        type,
        value,
        message:
          "Repository surface changed without updating .ai/inventory-baseline.json. Register the entity with its intended owner and verification.",
      })
    }
  }

  for (const value of baselineValues) {
    if (!currentSet.has(value)) {
      warnings.push({
        id: "inventory.stale-baseline-entry",
        type,
        value,
        message:
          "Inventory baseline references an entity that no longer exists. Remove it after confirming the deletion is intentional.",
      })
    }
  }
}

function collectInventory() {
  const profileDirs = listDirectories("profiles/sites", 2)
    .filter((dir) => fs.existsSync(path.join(root, dir, "site.json")))
    .sort()

  return {
    backendModules: listDirectories("apps/backend/src/modules", 1)
      .filter((dir) => dir !== "apps/backend/src/modules")
      .map((dir) => path.basename(dir))
      .sort(),
    backendApiRoutes: listFiles("apps/backend/src/api", (file) =>
      file.endsWith("/route.ts")
    ).sort(),
    backendWorkflows: listFiles("apps/backend/src/workflows", (file) =>
      file.endsWith(".ts")
    ).sort(),
    backendJobs: listFiles("apps/backend/src/jobs", (file) =>
      file.endsWith(".ts")
    ).sort(),
    storefrontEntrypoints: listFiles("apps/storefront/src/app", (file) =>
      file.endsWith("/page.tsx") || file.endsWith("/route.ts")
    ).sort(),
    adminEntrypoints: listFiles("apps/admin/src/app", (file) =>
      file.endsWith("/page.tsx") || file.endsWith("/route.ts")
    ).sort(),
    siteProfiles: profileDirs,
    aiScripts: listFiles("scripts/ai", (file) => file.endsWith(".mjs")).sort(),
  }
}

function collectSystemMapCoverage(inventory, baseline, issues, warnings) {
  const systemMap = readJson(".ai/system-map.json")
  const nodePaths = new Set(
    (systemMap.nodes || [])
      .map((node) => node.path)
      .filter((value) => typeof value === "string" && value.length > 0)
  )
  const mappedBackendModules = []
  const unmappedBackendModules = []

  for (const moduleName of inventory.backendModules) {
    const modulePath = `apps/backend/src/modules/${moduleName}`

    if (nodePaths.has(modulePath)) {
      mappedBackendModules.push(moduleName)
    } else {
      unmappedBackendModules.push(moduleName)
    }
  }

  const acceptedUnmapped = baseline?.systemMapCoverage?.acceptedUnmappedBackendModules || []
  const acceptedUnmappedByName = new Map()
  const today = new Date().toISOString().slice(0, 10)

  for (const entry of acceptedUnmapped) {
    if (!entry?.name) {
      issues.push({
        id: "inventory-baseline.system-map-unmapped-name-missing",
        message: "Accepted unmapped backend module entry must declare name.",
      })
      continue
    }

    acceptedUnmappedByName.set(entry.name, entry)

    for (const field of ["owner", "rationale", "target", "expiresAt"]) {
      if (!entry[field]) {
        issues.push({
          id: "inventory-baseline.system-map-unmapped-metadata-missing",
          value: entry.name,
          field,
          message:
            "Accepted unmapped backend modules must declare owner, rationale, target, and expiresAt.",
        })
      }
    }

    if (!Array.isArray(entry.verification) || entry.verification.length === 0) {
      issues.push({
        id: "inventory-baseline.system-map-unmapped-verification-missing",
        value: entry.name,
        message: "Accepted unmapped backend module must declare verification commands.",
      })
    }

    if (entry.expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(entry.expiresAt)) {
      issues.push({
        id: "inventory-baseline.system-map-unmapped-expiry-invalid",
        value: entry.name,
        expiresAt: entry.expiresAt,
        message: "Accepted unmapped backend module expiresAt must be YYYY-MM-DD.",
      })
    } else if (entry.expiresAt && entry.expiresAt < today) {
      issues.push({
        id: "inventory-baseline.system-map-unmapped-expired",
        value: entry.name,
        expiresAt: entry.expiresAt,
        message: "Accepted unmapped backend module expired. Add it to .ai/system-map.json or renew the rationale.",
      })
    }
  }

  for (const moduleName of unmappedBackendModules) {
    const accepted = acceptedUnmappedByName.get(moduleName)

    if (!accepted) {
      issues.push({
        id: criticalBackendModule(moduleName)
          ? "inventory.system-map-critical-backend-module-unmapped"
          : "inventory.system-map-backend-module-unmapped",
        type: "backendModules",
        value: moduleName,
        message:
          "Backend module is tracked in inventory but missing from .ai/system-map.json. Add a node with owner and verification, or explicitly baseline the gap.",
      })
      continue
    }

    warnings.push({
      id: "inventory.system-map-backend-module-unmapped-accepted",
      type: "backendModules",
      value: moduleName,
      path: `apps/backend/src/modules/${moduleName}`,
      owner: accepted.owner,
      expiresAt: accepted.expiresAt,
      message:
        "Backend module is not represented in .ai/system-map.json, but the gap is explicitly baselined with owner and expiry.",
    })
  }

  for (const [moduleName] of acceptedUnmappedByName) {
    if (!unmappedBackendModules.includes(moduleName)) {
      warnings.push({
        id: "inventory.system-map-unmapped-baseline-stale",
        type: "backendModules",
        value: moduleName,
        message:
          "System map unmapped-module baseline entry is no longer observed. Remove it after confirming the system map was intentionally updated.",
      })
    }
  }

  return {
    nodePathCount: nodePaths.size,
    mappedBackendModules,
    unmappedBackendModules,
    acceptedUnmappedBackendModules: unmappedBackendModules.filter((moduleName) =>
      acceptedUnmappedByName.has(moduleName)
    ),
  }
}

function criticalBackendModule(moduleName) {
  return /(payment|credential|delivery|security|supplier|audit|tenant)/.test(moduleName)
}

function countEntries(inventory) {
  return Object.fromEntries(
    Object.entries(inventory).map(([key, value]) => [key, value.length])
  )
}

export function createInventoryReport() {
  const issues = []
  const warnings = []
  const inventory = collectInventory()
  const baselinePath = ".ai/inventory-baseline.json"
  let baseline = null

  try {
    baseline = readJson(baselinePath)
  } catch (error) {
    issues.push({
      id: "inventory-baseline.invalid",
      path: baselinePath,
      message:
        error instanceof Error ? error.message : "Inventory baseline is invalid.",
    })
  }

  if (baseline?.tracked) {
    for (const [type, current] of Object.entries(inventory)) {
      compareTrackedList(type, current, baseline.tracked[type] || [], issues, warnings)
    }
  }

  const systemMapCoverage = collectSystemMapCoverage(inventory, baseline, issues, warnings)

  return {
    ok: issues.length === 0,
    generatedAt: new Date().toISOString(),
    issueCount: issues.length,
    warningCount: warnings.length,
    summary: countEntries(inventory),
    systemMapCoverage,
    inventory,
    issues,
    warnings,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = createInventoryReport()

  console.log(JSON.stringify(report, null, 2))

  if (!report.ok) {
    process.exit(1)
  }
}
