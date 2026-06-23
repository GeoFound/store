import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createArchitectureReport } from "./architecture.mjs"
import { createBackendDecouplingReadinessReport } from "./backend-decoupling-readiness.mjs"
import { createConfigSurfaceReport } from "./config-surface.mjs"
import { createInventoryReport } from "./inventory.mjs"
import { createObligationsReport } from "./obligations.mjs"
import { createProductionReadinessReport } from "./production-readiness.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const issues = []
const warnings = []

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath)

  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"))
  } catch (error) {
    issues.push({
      id: "json.invalid",
      path: relativePath,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function readJsonFiles(relativeDir) {
  const absoluteDir = path.join(root, relativeDir)

  if (!fs.existsSync(absoluteDir)) {
    return []
  }

  return fs.readdirSync(absoluteDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({
      path: path.join(relativeDir, name),
      data: readJson(path.join(relativeDir, name)),
    }))
    .filter((entry) => entry.data)
}

function sourceFiles(relativeDir) {
  const absoluteDir = path.join(root, relativeDir)

  if (!fs.existsSync(absoluteDir)) {
    return []
  }

  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === "__tests__") {
        return []
      }

      return sourceFiles(relativePath)
    }

    return entry.isFile() && /\.(ts|tsx|mts|mjs|js|jsx)$/.test(entry.name)
      ? [relativePath]
      : []
  })
}

function assert(condition, issue) {
  if (!condition) {
    issues.push(issue)
  }
}

export async function createDoctorReport() {
issues.length = 0
warnings.length = 0

const system = readJson(".ai/system.json")
const taskbook = readJson(".ai/taskbook.json")
const evidencePolicy = readJson(".ai/evidence-policy.json")
const systemMap = readJson(".ai/system-map.json")
readJson(".ai/obligations-policy.json")
readJson(".ai/backend-decoupling-readiness.json")
const adminControlPanelPolicy = readJson(".ai/admin-control-panel-policy.json")
const siteLifecyclePolicy = readJson(".ai/site-lifecycle-policy.json")
const configSurfacePolicy = readJson(".ai/config-surface.json")
const decisionRecords = readJsonFiles(".ai/decision-records")
const reviewChecklists = readJsonFiles(".ai/review-checklists")
const packageJson = readJson("package.json")

if (system) {
  assert(system.repository?.role === "engineering-system", {
    id: "system.repository.role",
    message: "Repository role must be engineering-system.",
  })
  assert(system.product?.role === "implemented-product", {
    id: "system.product.role",
    message: "Product role must be implemented-product.",
  })
  assert(system.evidencePolicy?.humanReviewIsAcceptance === false, {
    id: "system.evidence.human-review",
    message: "Human review must not be encoded as objective acceptance.",
  })

  for (const file of system.coldStart?.readFirst || []) {
    assert(exists(file), {
      id: "cold-start.file-missing",
      path: file,
      message: "Cold-start file does not exist.",
    })
  }

  for (const scriptName of system.automation?.requiredPackageScripts || []) {
    assert(Boolean(packageJson?.scripts?.[scriptName]), {
      id: "package.script-missing",
      script: scriptName,
      message: "Required package script is missing.",
    })
  }

  const platformBoundary = system.architectureBoundaries?.backendPlatformCore
  if (platformBoundary) {
    for (const file of sourceFiles(platformBoundary.path)) {
      const source = fs.readFileSync(path.join(root, file), "utf8")

      for (const forbiddenText of platformBoundary.mustNotContain || []) {
        assert(!source.includes(forbiddenText), {
          id: "architecture.platform-core-coupling",
          path: file,
          forbiddenText,
          message: "Platform core contains forbidden coupling text.",
        })
      }
    }
  }
}

if (systemMap) {
  const nodeIds = new Set()

  assert(Array.isArray(systemMap.nodes) && systemMap.nodes.length > 0, {
    id: "system-map.nodes-empty",
    message: "System map must contain nodes.",
  })
  assert(Array.isArray(systemMap.flows), {
    id: "system-map.flows-invalid",
    message: "System map flows must be an array.",
  })

  for (const node of systemMap.nodes || []) {
    assert(Boolean(node.id), {
      id: "system-map.node-id-missing",
      message: "System map node is missing id.",
    })
    assert(!nodeIds.has(node.id), {
      id: "system-map.node-id-duplicate",
      node: node.id,
      message: "System map node id must be unique.",
    })
    nodeIds.add(node.id)

    if (node.path) {
      assert(exists(node.path), {
        id: "system-map.node-path-missing",
        node: node.id,
        path: node.path,
        message: "System map node path does not exist.",
      })
    }

    assert(Array.isArray(node.verification || node.evidence), {
      id: "system-map.node-evidence-missing",
      node: node.id,
      message: "System map node must declare verification or evidence.",
    })
  }

  for (const flow of systemMap.flows || []) {
    assert(Boolean(flow.id), {
      id: "system-map.flow-id-missing",
      message: "System map flow is missing id.",
    })
    assert(nodeIds.has(flow.from), {
      id: "system-map.flow-from-invalid",
      flow: flow.id,
      node: flow.from,
      message: "System map flow references an unknown from node.",
    })
    assert(nodeIds.has(flow.to), {
      id: "system-map.flow-to-invalid",
      flow: flow.id,
      node: flow.to,
      message: "System map flow references an unknown to node.",
    })
    for (const nodeId of flow.through || []) {
      assert(nodeIds.has(nodeId), {
        id: "system-map.flow-through-invalid",
        flow: flow.id,
        node: nodeId,
        message: "System map flow references an unknown through node.",
      })
    }
  }
}

const decisionIds = new Set()
assert(decisionRecords.length > 0, {
  id: "decision-records.empty",
  message: "At least one machine-readable decision record is required.",
})
for (const record of decisionRecords) {
  const data = record.data

  assert(Boolean(data.id), {
    id: "decision-record.id-missing",
    path: record.path,
    message: "Decision record is missing id.",
  })
  assert(!decisionIds.has(data.id), {
    id: "decision-record.id-duplicate",
    path: record.path,
    decisionId: data.id,
    message: "Decision record id must be unique.",
  })
  decisionIds.add(data.id)
  assert(["proposed", "accepted", "superseded", "rejected"].includes(data.status), {
    id: "decision-record.status-invalid",
    path: record.path,
    status: data.status,
    message: "Decision record status is invalid.",
  })
  assert(Boolean(data.decision), {
    id: "decision-record.decision-missing",
    path: record.path,
    message: "Decision record must include a decision.",
  })
  assert(Array.isArray(data.evidence) && data.evidence.length > 0, {
    id: "decision-record.evidence-missing",
    path: record.path,
    message: "Decision record must include evidence references.",
  })
  assert(/^ADR-\d{4}$/.test(data.id), {
    id: "decision-record.id-format-invalid",
    path: record.path,
    decisionId: data.id,
    message: "Decision record id must use ADR-0000 format.",
  })
}

const checklistIds = new Set()
assert(reviewChecklists.length > 0, {
  id: "review-checklists.empty",
  message: "At least one machine-readable review checklist is required.",
})
for (const checklist of reviewChecklists) {
  const data = checklist.data

  assert(Boolean(data.id), {
    id: "review-checklist.id-missing",
    path: checklist.path,
    message: "Review checklist is missing id.",
  })
  assert(!checklistIds.has(data.id), {
    id: "review-checklist.id-duplicate",
    path: checklist.path,
    checklistId: data.id,
    message: "Review checklist id must be unique.",
  })
  checklistIds.add(data.id)
  assert(Array.isArray(data.items) && data.items.length > 0, {
    id: "review-checklist.items-missing",
    path: checklist.path,
    message: "Review checklist must include items.",
  })
  assert(data.execution?.mode === "guidance", {
    id: "review-checklist.execution-mode-invalid",
    path: checklist.path,
    mode: data.execution?.mode,
    message:
      "Review checklists are guidance artifacts. Executed commands must be represented in .ai/evidence-policy.json, .ai/taskbook.json, or package scripts.",
  })
  assert(Array.isArray(data.execution?.commandsAreRunBy) && data.execution.commandsAreRunBy.length > 0, {
    id: "review-checklist.execution-owner-missing",
    path: checklist.path,
    message: "Review checklist must declare where its commands are actually executed.",
  })

  for (const item of data.items || []) {
    assert(Boolean(item.id), {
      id: "review-checklist.item-id-missing",
      path: checklist.path,
      message: "Review checklist item is missing id.",
    })
    assert(Boolean(item.checkType), {
      id: "review-checklist.item-type-missing",
      path: checklist.path,
      item: item.id,
      message: "Review checklist item is missing checkType.",
    })
    assert(Boolean(item.evidenceRequired), {
      id: "review-checklist.item-evidence-missing",
      path: checklist.path,
      item: item.id,
      message: "Review checklist item must describe required evidence.",
    })

    if (item.checkType === "command") {
      assert(Array.isArray(item.command) && item.command.length > 0, {
        id: "review-checklist.item-command-invalid",
        path: checklist.path,
        item: item.id,
        message: "Command checklist item must use an argv command array.",
      })
    }
  }
}

assert(exists(".github/workflows/ai-maintenance.yml"), {
  id: "workflow.ai-maintenance-missing",
  message: "AI maintenance workflow is required.",
})
if (exists(".github/workflows/ai-maintenance.yml")) {
  const workflow = fs.readFileSync(
    path.join(root, ".github/workflows/ai-maintenance.yml"),
    "utf8"
  )

  assert(workflow.includes("schedule:"), {
    id: "workflow.ai-maintenance-schedule-missing",
    message: "AI maintenance workflow must run on a schedule.",
  })
  assert(workflow.includes("pnpm ai:evidence:full"), {
    id: "workflow.ai-maintenance-evidence-missing",
    message: "AI maintenance workflow must run pnpm ai:evidence:full.",
  })
}

assert(exists(".github/CODEOWNERS"), {
  id: "github.codeowners-missing",
  message: "CODEOWNERS is required so governance-critical files have explicit review ownership.",
})
if (exists(".github/CODEOWNERS")) {
  const codeowners = fs.readFileSync(path.join(root, ".github/CODEOWNERS"), "utf8")

  for (const requiredPattern of [".ai/", "scripts/ai/", "apps/backend/src/api/", "apps/backend/src/modules/", "ops/env/"]) {
    assert(codeowners.includes(requiredPattern), {
      id: "github.codeowners-pattern-missing",
      pattern: requiredPattern,
      message: "CODEOWNERS must cover governance-critical product and repository surfaces.",
    })
  }
}

assert(exists(".github/pull_request_template.md"), {
  id: "github.pr-template-missing",
  message: "Pull request template is required so AI/human changes declare machine evidence and production risk.",
})
if (exists(".github/pull_request_template.md")) {
  const template = fs.readFileSync(path.join(root, ".github/pull_request_template.md"), "utf8")

  for (const requiredText of ["pnpm ai:doctor", "pnpm ai:production", "Production risk"]) {
    assert(template.includes(requiredText), {
      id: "github.pr-template-evidence-missing",
      text: requiredText,
      message: "Pull request template must name required governance and production evidence.",
    })
  }
}

if (taskbook) {
  assert(Array.isArray(taskbook.tasks) && taskbook.tasks.length > 0, {
    id: "taskbook.empty",
    message: "Taskbook must contain at least one task.",
  })

  for (const task of taskbook.tasks || []) {
    assert(Boolean(task.id), {
      id: "task.id-missing",
      message: "Task is missing id.",
    })
    assert(Array.isArray(task.commands) && task.commands.length > 0, {
      id: "task.commands-missing",
      task: task.id,
      message: "Task must declare executable commands.",
    })
    assert(Array.isArray(task.evidence) && task.evidence.length > 0, {
      id: "task.evidence-missing",
      task: task.id,
      message: "Task must declare expected evidence.",
    })
  }
}

if (evidencePolicy) {
  for (const check of [
    ...(evidencePolicy.defaultChecks || []),
    ...(evidencePolicy.fullChecks || []),
  ]) {
    assert(Array.isArray(check.command) && check.command.length > 0, {
      id: "evidence.command-invalid",
      check: check.id,
      message: "Evidence check command must be an argv array.",
    })
  }

  for (const check of evidencePolicy.productionChecks || []) {
    if (check.requiresRuntime !== true) {
      warnings.push({
        id: "evidence.production-runtime-flag",
        check: check.id,
        message: "Production evidence checks should explicitly say whether runtime is required.",
      })
    }
  }
}

if (adminControlPanelPolicy) {
  validateAdminControlPanelPolicy({
    policy: adminControlPanelPolicy,
    siteLifecyclePolicy,
    configSurfacePolicy,
    evidencePolicy,
    packageJson,
  })
}

const configSurfaceReport = createConfigSurfaceReport()
assert(configSurfaceReport.ok, {
  id: "config-surface.failed",
  message: "Machine-readable config surface validation failed.",
  issues: configSurfaceReport.issues,
})

for (const warning of configSurfaceReport.warnings || []) {
  warnings.push({
    id: `config-surface.${warning.id}`,
    path: warning.path,
    message: warning.message,
    details: {
      key: warning.key,
    },
  })
}

const architectureReport = await createArchitectureReport()
assert(architectureReport.ok, {
  id: "architecture.failed",
  message: "Machine-readable architecture validation failed.",
  issues: architectureReport.issues,
})

for (const warning of architectureReport.warnings || []) {
  warnings.push({
    id: `architecture.${warning.id}`,
    path: warning.path,
    message: warning.message,
    details: {
      import: warning.import,
      lines: warning.lines,
      maxLines: warning.maxLines,
      localFunctions: warning.localFunctions,
      maxLocalFunctions: warning.maxLocalFunctions,
      fromModule: warning.fromModule,
      toModule: warning.toModule,
    },
  })
}

const backendDecouplingReport = createBackendDecouplingReadinessReport()
assert(backendDecouplingReport.ok, {
  id: "backend-decoupling.failed",
  message: "Machine-readable backend decoupling readiness validation failed.",
  issues: backendDecouplingReport.issues,
})

for (const warning of backendDecouplingReport.warnings || []) {
  warnings.push({
    id: `backend-decoupling.${warning.id}`,
    path: warning.path,
    message: warning.message,
    details: {
      value: warning.value,
      max: warning.max,
      target: warning.target,
      exit: warning.details?.exit,
    },
  })
}

const inventoryReport = createInventoryReport()
assert(inventoryReport.ok, {
  id: "inventory.failed",
  message: "Machine-readable repository inventory validation failed.",
  issues: inventoryReport.issues,
})

for (const warning of inventoryReport.warnings || []) {
  warnings.push({
    id: `inventory.${warning.id}`,
    path: warning.path,
    message: warning.message,
    details: {
      type: warning.type,
      value: warning.value,
    },
  })
}

const productionReport = createProductionReadinessReport()
assert(productionReport.ok, {
  id: "production-readiness.failed",
  message: "Machine-readable production readiness validation failed.",
  issues: productionReport.issues,
})

for (const warning of productionReport.warnings || []) {
  warnings.push({
    id: `production-readiness.${warning.id}`,
    path: warning.path,
    message: warning.message,
    details: {
      method: warning.method,
      owner: warning.owner,
      expiresAt: warning.expiresAt,
    },
  })
}

const obligationsReport = createObligationsReport()
assert(obligationsReport.ok, {
  id: "obligations.failed",
  message: "Machine-readable obligation validation failed.",
  issues: obligationsReport.issues,
})

for (const warning of obligationsReport.warnings || []) {
  warnings.push({
    id: `obligations.${warning.id}`,
    message: warning.message,
    details: warning.details || {},
  })
}

return {
  ok: issues.length === 0,
  generatedAt: new Date().toISOString(),
  issueCount: issues.length,
  warningCount: warnings.length,
  issues,
  warnings,
}
}

function validateAdminControlPanelPolicy(input) {
  const policy = input.policy
  const siteLifecyclePolicy = input.siteLifecyclePolicy || {}
  const configSurfacePolicy = input.configSurfacePolicy || {}
  const evidencePolicy = input.evidencePolicy || {}
  const packageJson = input.packageJson || {}
  const surfaces = policy.requiredProductionSurfaces || []
  const informationArchitecture = policy.informationArchitecture || {}
  const sectionOrder = Array.isArray(informationArchitecture.sectionOrder)
    ? informationArchitecture.sectionOrder
    : []
  const routePlacements = Array.isArray(informationArchitecture.routePlacements)
    ? informationArchitecture.routePlacements
    : []
  const routePrefix =
    typeof informationArchitecture.routePrefix === "string" && informationArchitecture.routePrefix
      ? informationArchitecture.routePrefix
      : "/app"
  const routeSourceRoot =
    typeof informationArchitecture.routeSourceRoot === "string" && informationArchitecture.routeSourceRoot
      ? informationArchitecture.routeSourceRoot
      : "apps/backend/src/admin/routes"
  const allowedSections = new Set(sectionOrder.map((section) => section.id).filter(Boolean))
  const placedRoutes = new Set(routePlacements.map((placement) => placement.route).filter(Boolean))
  const profileControls = new Set(siteLifecyclePolicy.requiredControls || [])
  const evidenceFields = new Set([
    ...(siteLifecyclePolicy.promotionEvidenceFields || []),
    ...(siteLifecyclePolicy.productionOnlyEvidenceFields || []),
  ])
  const configEntries = configSurfacePolicy.entries || {}
  const configKeys = new Set(Object.keys(configEntries))
  const coveredConfigKeys = new Set()
  const coveredProductionCommands = new Set()
  const expectedProductionCommands = new Set(
    (evidencePolicy.productionChecks || [])
      .map((check) => Array.isArray(check.command) ? check.command.join(" ") : "")
      .filter(Boolean)
  )
  const surfaceIds = new Set()

  assert(typeof policy.productionControlRule === "string" && policy.productionControlRule.length > 0, {
    id: "admin-control-panel.production-control-rule-missing",
    message: "Admin control panel policy must declare the production control rule.",
  })
  assert(Array.isArray(policy.forbiddenSurface) && policy.forbiddenSurface.length > 0, {
    id: "admin-control-panel.forbidden-surface-missing",
    message: "Admin control panel policy must declare forbidden backend panel surfaces.",
  })
  assert(Array.isArray(surfaces) && surfaces.length > 0, {
    id: "admin-control-panel.production-surfaces-missing",
    message: "Admin control panel policy must declare required production surfaces.",
  })
  assert(isRouteInPrefix(informationArchitecture.defaultAdminRoute, routePrefix), {
    id: "admin-control-panel.default-admin-route-invalid",
    route: informationArchitecture.defaultAdminRoute,
    message: "Admin control panel policy must declare a default backend admin route.",
  })
  assert(Array.isArray(sectionOrder) && sectionOrder.length > 0, {
    id: "admin-control-panel.information-architecture-sections-missing",
    message: "Admin control panel policy must declare ordered information architecture sections.",
  })
  assert(Array.isArray(routePlacements) && routePlacements.length > 0, {
    id: "admin-control-panel.route-placements-missing",
    message: "Admin control panel policy must declare backend admin route placements.",
  })

  const sectionIds = new Set()

  for (const section of sectionOrder) {
    assert(Boolean(section.id), {
      id: "admin-control-panel.section-id-missing",
      message: "Admin control panel information architecture section is missing id.",
    })
    if (section.id) {
      assert(!sectionIds.has(section.id), {
        id: "admin-control-panel.section-id-duplicate",
        section: section.id,
        message: "Admin control panel information architecture section id must be unique.",
      })
      sectionIds.add(section.id)
    }
    for (const key of ["title", "description"]) {
      assert(Boolean(section[key]), {
        id: "admin-control-panel.section-metadata-missing",
        section: section.id,
        field: key,
        message: "Admin control panel information architecture section is missing metadata.",
      })
    }
  }

  const routeIds = new Set()

  for (const placement of routePlacements) {
    assert(isRouteInPrefix(placement.route, routePrefix), {
      id: "admin-control-panel.route-placement-route-invalid",
      route: placement.route,
      message: "Admin control panel route placement must point to a backend admin app route.",
    })
    assert(allowedSections.has(placement.section), {
      id: "admin-control-panel.route-placement-section-invalid",
      route: placement.route,
      section: placement.section,
      message: "Admin control panel route placement references an unknown information architecture section.",
    })
    if (placement.route) {
      assert(!routeIds.has(placement.route), {
        id: "admin-control-panel.route-placement-duplicate",
        route: placement.route,
        message: "Admin control panel route placement route must be unique.",
      })
      routeIds.add(placement.route)
    }
    for (const key of ["title", "owner", "purpose"]) {
      assert(Boolean(placement[key]), {
        id: "admin-control-panel.route-placement-metadata-missing",
        route: placement.route,
        field: key,
        message: "Admin control panel route placement is missing metadata.",
      })
    }
  }

  for (const file of sourceFiles(routeSourceRoot).filter((name) => name.endsWith("/page.tsx"))) {
    const route = adminRouteFromPage(file, routeSourceRoot, routePrefix)

    assert(placedRoutes.has(route), {
      id: "admin-control-panel.admin-route-unplaced",
      route,
      path: file,
      message: "Backend admin route is missing from admin control panel information architecture.",
    })
  }

  for (const surface of surfaces) {
    assert(Boolean(surface.id), {
      id: "admin-control-panel.surface-id-missing",
      message: "Required production surface is missing id.",
    })
    if (surface.id) {
      assert(!surfaceIds.has(surface.id), {
        id: "admin-control-panel.surface-id-duplicate",
        surface: surface.id,
        message: "Required production surface id must be unique.",
      })
      surfaceIds.add(surface.id)
    }

    for (const key of ["title", "owner", "adminRoute", "controlPanelSection"]) {
      assert(Boolean(surface[key]), {
        id: "admin-control-panel.surface-metadata-missing",
        surface: surface.id,
        field: key,
        message: "Required production surface is missing metadata.",
      })
    }

    assert(surface.backendPanelRequired === true, {
      id: "admin-control-panel.surface-backend-panel-not-required",
      surface: surface.id,
      message: "Production-significant surfaces must require a backend panel.",
    })
    assert(surface.productionGateRequired === true, {
      id: "admin-control-panel.surface-production-gate-not-required",
      surface: surface.id,
      message: "Production-significant surfaces must require a production gate.",
    })
    assert(
      isRouteInPrefix(surface.adminRoute, routePrefix),
      {
        id: "admin-control-panel.surface-admin-route-invalid",
        surface: surface.id,
        route: surface.adminRoute,
        message: "Required production surface adminRoute must point to a backend admin app route.",
      }
    )
    assert(placedRoutes.has(surface.adminRoute), {
      id: "admin-control-panel.surface-admin-route-unplaced",
      surface: surface.id,
      route: surface.adminRoute,
      message: "Required production surface adminRoute is not placed in the backend control panel information architecture.",
    })
    assert(allowedSections.has(surface.controlPanelSection), {
      id: "admin-control-panel.surface-section-invalid",
      surface: surface.id,
      section: surface.controlPanelSection,
      message: "Required production surface references an unknown ops-control section.",
    })

    for (const control of surface.profileControls || []) {
      assert(profileControls.has(control), {
        id: "admin-control-panel.surface-profile-control-untracked",
        surface: surface.id,
        control,
        message: "Required production surface references a site lifecycle control not declared in policy.requiredControls.",
      })
    }

    for (const field of surface.evidenceFields || []) {
      assert(evidenceFields.has(field), {
        id: "admin-control-panel.surface-evidence-field-untracked",
        surface: surface.id,
        field,
        message: "Required production surface references an evidence field not enforced by site lifecycle policy.",
      })
    }

    for (const command of surface.runtimeCommands || []) {
      const scriptName = command.startsWith("pnpm ") ? command.slice("pnpm ".length) : ""

      if (scriptName) {
        assert(Boolean(packageJson.scripts?.[scriptName]), {
          id: "admin-control-panel.surface-runtime-command-missing-script",
          surface: surface.id,
          command,
          message: "Required production surface references a pnpm script that is not registered.",
        })
      }

      if (expectedProductionCommands.has(command)) {
        coveredProductionCommands.add(command)
      }
    }

    for (const key of surface.configKeys || []) {
      coveredConfigKeys.add(key)
      assert(configKeys.has(key), {
        id: "admin-control-panel.surface-config-key-unregistered",
        surface: surface.id,
        key,
        message: "Required production surface references a runtime config key not registered in .ai/config-surface.json.",
      })
    }
  }

  for (const command of expectedProductionCommands) {
    assert(coveredProductionCommands.has(command), {
      id: "admin-control-panel.production-command-uncovered",
      command,
      message: "Production evidence command is not mapped to a backend control panel production surface.",
    })
  }

  for (const [key, entry] of Object.entries(configEntries)) {
    if (entry?.requiredInProduction !== true) {
      continue
    }

    assert(coveredConfigKeys.has(key), {
      id: "admin-control-panel.production-config-key-uncovered",
      key,
      owner: entry.owner,
      message: "Production-required config key is not mapped to any backend control panel production surface.",
    })
  }
}

function isRouteInPrefix(route, routePrefix) {
  return (
    typeof route === "string" &&
    (route === routePrefix || route.startsWith(`${routePrefix}/`))
  )
}

function adminRouteFromPage(file, routeSourceRoot, routePrefix) {
  const relative = file
    .replace(`${routeSourceRoot}/`, "")
    .replaceAll("\\", "/")

  if (relative === "page.tsx") {
    return routePrefix
  }

  return `${routePrefix}/${relative.replace(/\/page\.tsx$/, "")}`
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await createDoctorReport()

  console.log(JSON.stringify(report, null, 2))

  if (!report.ok) {
    process.exit(1)
  }
}
