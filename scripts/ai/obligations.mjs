import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { createConfigSurfaceReport } from "./config-surface.mjs"
import { createInventoryReport } from "./inventory.mjs"
import { createProductionReadinessReport } from "./production-readiness.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const POLICY_PATH = ".ai/obligations-policy.json"

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"))
}

function safeReadJson(relativePath, issues) {
  try {
    return readJson(relativePath)
  } catch (error) {
    issues.push({
      id: "obligations.input-json-invalid",
      subject: relativePath,
      message: error instanceof Error ? error.message : String(error),
      details: { path: relativePath },
    })
    return {}
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function normalizePath(value) {
  return value.split(path.sep).join("/")
}

function commandText(command) {
  if (Array.isArray(command)) {
    return command.join(" ")
  }

  return String(command || "")
}

function trackedValue(entry) {
  if (typeof entry === "string") {
    return entry
  }

  return entry?.path || entry?.name || entry?.value || ""
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
  })

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  }
}

function readJsonFromGit(ref, relativePath, warnings) {
  if (!ref) {
    return null
  }

  const result = run("git", ["show", `${ref}:${relativePath}`])

  if (!result.ok || !result.stdout) {
    warnings.push({
      id: "obligations.compare-ref-file-unavailable",
      path: relativePath,
      compareRef: ref,
      message: "Could not read previous machine-readable file from compare ref.",
    })
    return null
  }

  try {
    return JSON.parse(result.stdout)
  } catch (error) {
    warnings.push({
      id: "obligations.compare-ref-json-invalid",
      path: relativePath,
      compareRef: ref,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

function collectChangedFiles(compareRef) {
  if (compareRef) {
    const result = run("git", ["diff", "--name-only", `${compareRef}...HEAD`])

    if (result.ok) {
      return result.stdout.split("\n").filter(Boolean).map(normalizePath).sort()
    }
  }

  const status = run("git", ["status", "--short"])

  if (!status.ok || !status.stdout) {
    return []
  }

  return status.stdout
    .split("\n")
    .map(parseStatusPath)
    .filter(Boolean)
    .sort()
}

function parseStatusPath(line) {
  const trimmed = line.trimEnd()
  const renamedPath = trimmed.includes(" -> ")
    ? trimmed.split(" -> ").pop()
    : trimmed.replace(/^[ MARCUD?!]{1,2}\s+/, "")

  return normalizePath(String(renamedPath || "").trim())
}

function add(obligations, issues, warnings, input) {
  const status = input.ok ? "satisfied" : input.severity || "issue"
  const obligation = {
    id: input.id,
    subject: input.subject,
    status,
    evidence: input.evidence || [],
    message: input.message,
  }

  obligations.push(obligation)

  if (status === "issue") {
    issues.push({
      id: input.id,
      subject: input.subject,
      message: input.message,
      details: input.details || {},
    })
  } else if (status === "warning") {
    warnings.push({
      id: input.id,
      subject: input.subject,
      message: input.message,
      details: input.details || {},
    })
  }
}

function packageForDir(relativeDir) {
  const packagePath = path.join(root, relativeDir, "package.json")

  if (!fs.existsSync(packagePath)) {
    return null
  }

  return JSON.parse(fs.readFileSync(packagePath, "utf8"))
}

function commandExists(command, packageJson) {
  const text = commandText(command).trim()

  if (!text) {
    return false
  }

  if (text.includes("<") || text.includes(">")) {
    return true
  }

  if (text.startsWith("pnpm --dir ")) {
    const parts = text.split(/\s+/)
    const dir = parts[2]
    const script = parts[3]
    const packageInDir = packageForDir(dir)

    return Boolean(packageInDir?.scripts?.[script]) || script === "exec"
  }

  if (text.startsWith("pnpm ")) {
    const script = text.split(/\s+/)[1]
    return Boolean(packageJson.scripts?.[script])
  }

  if (text.startsWith("git ")) {
    return true
  }

  if (text.startsWith(".")) {
    return exists(text)
  }

  return true
}

function validateCommandList(commands, context, packageJson, obligations, issues, warnings) {
  for (const command of commands || []) {
    const text = commandText(command)

    add(obligations, issues, warnings, {
      id: "obligations.command-reference-valid",
      subject: `${context}: ${text}`,
      ok: commandExists(command, packageJson),
      evidence: [text],
      message: "Obligation command reference must map to a package script, known shell command, or existing file.",
    })
  }
}

function entryByTrackedValue(entries) {
  return new Map((entries || []).map((entry) => [trackedValue(entry), entry]))
}

function readPatchedDependencies() {
  const workspacePath = path.join(root, "pnpm-workspace.yaml")

  if (!fs.existsSync(workspacePath)) {
    return []
  }

  const lines = fs.readFileSync(workspacePath, "utf8").split(/\r?\n/)
  const entries = []
  let inPatchedDependencies = false

  for (const line of lines) {
    if (/^\S/.test(line)) {
      inPatchedDependencies = line.trim() === "patchedDependencies:"
      continue
    }

    if (!inPatchedDependencies) {
      continue
    }

    const match = line.match(/^\s{2}['"]?([^'":]+)['"]?:\s+(.+)$/)

    if (!match) {
      continue
    }

    entries.push({
      dependency: match[1].trim(),
      patchPath: match[2].trim().replace(/^['"]|['"]$/g, ""),
    })
  }

  return entries
}

function validateUnifiedPatch(relativePath) {
  const absolutePath = path.join(root, relativePath)

  if (!fs.existsSync(absolutePath)) {
    return {
      exists: false,
      hunkCount: 0,
      invalidHunks: [],
    }
  }

  const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/)
  const invalidHunks = []
  let currentHunk = null
  let hunkCount = 0

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]

    if (line.startsWith("diff --git ")) {
      currentHunk = null
      continue
    }

    const header = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)

    if (header) {
      currentHunk = {
        line: index + 1,
        oldExpected: header[2] ? Number(header[2]) : 1,
        newExpected: header[4] ? Number(header[4]) : 1,
        oldActual: 0,
        newActual: 0,
      }
      hunkCount += 1
      invalidHunks.push(currentHunk)
      continue
    }

    if (!currentHunk || line.startsWith("\\ No newline")) {
      continue
    }

    const marker = line[0]

    if (marker === " ") {
      currentHunk.oldActual += 1
      currentHunk.newActual += 1
    } else if (marker === "-") {
      currentHunk.oldActual += 1
    } else if (marker === "+") {
      currentHunk.newActual += 1
    }
  }

  return {
    exists: true,
    hunkCount,
    invalidHunks: invalidHunks.filter(
      (hunk) =>
        hunk.oldExpected !== hunk.oldActual ||
        hunk.newExpected !== hunk.newActual
    ),
  }
}

function validatePolicy(policy, packageJson, obligations, issues, warnings) {
  add(obligations, issues, warnings, {
    id: "obligations.policy-version-present",
    subject: POLICY_PATH,
    ok: typeof policy?.version === "string" && policy.version.length > 0,
    evidence: [POLICY_PATH],
    message: "Obligations policy must declare a version.",
  })

  add(obligations, issues, warnings, {
    id: "obligations.policy-principles-present",
    subject: POLICY_PATH,
    ok: Array.isArray(policy?.principles) && policy.principles.length > 0,
    evidence: [POLICY_PATH],
    message: "Obligations policy must declare principles.",
  })

  for (const scriptName of policy?.requiredPackageScripts || []) {
    add(obligations, issues, warnings, {
      id: "obligations.required-package-script-present",
      subject: scriptName,
      ok: Boolean(packageJson.scripts?.[scriptName]),
      evidence: ["package.json"],
      message: "Required obligation package script must exist.",
    })
  }

  for (const file of policy?.requiredColdStartFiles || []) {
    add(obligations, issues, warnings, {
      id: "obligations.required-cold-start-file-present",
      subject: file,
      ok: exists(file),
      evidence: [file],
      message: "Required obligation cold-start file must exist.",
    })
  }

  for (const rule of policy?.rules || []) {
    add(obligations, issues, warnings, {
      id: "obligations.policy-rule-executable",
      subject: rule.id || "unknown-rule",
      ok: Boolean(rule.id) && Array.isArray(rule.enforcedBy) && rule.enforcedBy.length > 0,
      evidence: rule.enforcedBy || [],
      message: "Every obligation rule must declare executable enforcement.",
    })
    validateCommandList(rule.enforcedBy || [], `obligation rule ${rule.id}`, packageJson, obligations, issues, warnings)
  }
}

function validatePatchObligations(input) {
  const { obligations, issues, warnings } = input
  const patchedDependencies = readPatchedDependencies()

  for (const entry of patchedDependencies) {
    const result = validateUnifiedPatch(entry.patchPath)

    add(obligations, issues, warnings, {
      id: "obligations.patched-dependency-file-present",
      subject: entry.dependency,
      ok: result.exists,
      evidence: ["pnpm-workspace.yaml", entry.patchPath],
      message: "Patched dependency must point to an existing patch file.",
      details: { patchPath: entry.patchPath },
    })

    add(obligations, issues, warnings, {
      id: "obligations.patch-hunk-header-integrity",
      subject: entry.patchPath,
      ok: result.exists && result.hunkCount > 0 && result.invalidHunks.length === 0,
      evidence: [entry.patchPath, "pnpm install --frozen-lockfile"],
      message: "Patch hunk headers must match actual old and new line counts so clean installs can apply patched dependencies.",
      details: {
        dependency: entry.dependency,
        hunkCount: result.hunkCount,
        invalidHunks: result.invalidHunks,
      },
    })
  }
}

function validateInventoryObligations(input) {
  const {
    baseline,
    inventoryReport,
    productionReport,
    packageJson,
    obligations,
    issues,
    warnings,
  } = input
  const tracked = baseline?.tracked || {}
  const productionRoutePaths = new Set(
    (productionReport.routeContract?.routes || []).map((route) => route.path)
  )
  const packageScriptValues = Object.values(packageJson.scripts || {})

  add(obligations, issues, warnings, {
    id: "obligations.inventory-report-clean",
    subject: ".ai/inventory-baseline.json",
    ok: inventoryReport.ok === true,
    evidence: ["pnpm ai:inventory"],
    message: "Repository surface inventory must be registered before obligations can be trusted.",
    details: { issues: inventoryReport.issues },
  })

  for (const moduleName of inventoryReport.inventory.backendModules || []) {
    add(obligations, issues, warnings, {
      id: "obligations.backend-module-system-mapped",
      subject: moduleName,
      ok: !inventoryReport.systemMapCoverage.unmappedBackendModules.includes(moduleName),
      evidence: [".ai/system-map.json", "pnpm ai:inventory"],
      message: "Backend module must be represented in the system map or explicitly baselined with expiry.",
    })
  }

  for (const routePath of inventoryReport.inventory.backendApiRoutes || []) {
    add(obligations, issues, warnings, {
      id: "obligations.api-route-has-production-contract",
      subject: routePath,
      ok: productionRoutePaths.has(routePath),
      evidence: [".ai/production-readiness.json", "pnpm ai:production"],
      message: "Backend API route must be represented in the production route contract.",
    })
  }

  for (const scriptPath of inventoryReport.inventory.aiScripts || []) {
    const referencedByPackageScript = packageScriptValues.some((value) => value.includes(scriptPath))
    const baselineEntry = entryByTrackedValue(tracked.aiScripts).get(scriptPath)

    add(obligations, issues, warnings, {
      id: "obligations.ai-script-has-package-entry",
      subject: scriptPath,
      ok: referencedByPackageScript,
      evidence: ["package.json", "pnpm ai:inventory"],
      message: "AI script must be callable through a package script.",
    })

    add(obligations, issues, warnings, {
      id: "obligations.ai-script-baseline-metadata",
      subject: scriptPath,
      ok: Boolean(baselineEntry?.owner) && Array.isArray(baselineEntry?.verification),
      evidence: [".ai/inventory-baseline.json"],
      message: "AI script baseline entry must declare owner and verification.",
    })
  }
}

function validateProductionObligations(input) {
  const { policy, productionReport, configReport, obligations, issues, warnings } = input
  const maxAcceptedDebt = policy?.limits?.maxAcceptedBodyValidationDebt ?? 0

  add(obligations, issues, warnings, {
    id: "obligations.production-report-clean",
    subject: ".ai/production-readiness.json",
    ok: productionReport.ok === true,
    evidence: ["pnpm ai:production"],
    message: "Production readiness report must be clean before obligations can be trusted.",
    details: { issues: productionReport.issues },
  })

  add(obligations, issues, warnings, {
    id: "obligations.body-validation-debt-within-budget",
    subject: "API body validation",
    ok: (productionReport.summary?.acceptedDebtBodyMethods || 0) <= maxAcceptedDebt,
    evidence: ["pnpm ai:production", ".ai/production-readiness.json"],
    message: "Accepted body-validation debt must not exceed the obligations budget.",
    details: {
      current: productionReport.summary?.acceptedDebtBodyMethods || 0,
      maxAcceptedDebt,
    },
  })

  add(obligations, issues, warnings, {
    id: "obligations.config-report-clean",
    subject: ".ai/config-surface.json",
    ok: configReport.ok === true,
    evidence: ["pnpm ai:config"],
    message: "Runtime configuration surface must be registered and valid.",
    details: { issues: configReport.issues },
  })

  const actualEnvChecked = (productionReport.productionConfig?.actualEnvFiles || []).some(
    (entry) => entry.checked === true
  )

  add(obligations, issues, warnings, {
    id: "obligations.actual-production-env-check-deferred",
    subject: "actual production env files",
    ok: actualEnvChecked,
    severity: "deferred",
    evidence: ["AI_BACKEND_PRODUCTION_ENV_FILE", "AI_STOREFRONT_PRODUCTION_ENV_FILE", "AI_SERVICES_PRODUCTION_ENV_FILE", "AI_OPS_PRODUCTION_ENV_FILE"],
    message: "Actual production env files were not provided; this remains a go-live-only obligation.",
  })
}

function validateControlPanelObligations(input) {
  const {
    adminPolicy,
    configSurface,
    evidencePolicy,
    packageJson,
    obligations,
    issues,
    warnings,
  } = input
  const requiredProductionKeys = new Set(
    Object.entries(configSurface.entries || {})
      .filter(([, entry]) => entry?.requiredInProduction === true)
      .map(([key]) => key)
  )
  const coveredConfigKeys = new Set()
  const productionCommands = new Set(
    (evidencePolicy.productionChecks || []).map((check) => commandText(check.command))
  )
  const coveredProductionCommands = new Set()
  const placedRoutes = new Set(
    (adminPolicy.informationArchitecture?.routePlacements || []).map((placement) => placement.route)
  )

  for (const surface of adminPolicy.requiredProductionSurfaces || []) {
    for (const key of surface.configKeys || []) {
      coveredConfigKeys.add(key)
    }

    for (const command of surface.runtimeCommands || []) {
      if (productionCommands.has(command)) {
        coveredProductionCommands.add(command)
      }
    }

    add(obligations, issues, warnings, {
      id: "obligations.production-surface-visible",
      subject: surface.id,
      ok: surface.backendPanelRequired === true && placedRoutes.has(surface.adminRoute),
      evidence: [".ai/admin-control-panel-policy.json"],
      message: "Production-significant surface must be visible in the backend control panel information architecture.",
    })

    add(obligations, issues, warnings, {
      id: "obligations.production-surface-gated",
      subject: surface.id,
      ok:
        surface.productionGateRequired === true &&
        ((surface.evidenceFields || []).length > 0 || (surface.runtimeCommands || []).length > 0),
      evidence: [".ai/admin-control-panel-policy.json", ".ai/site-lifecycle-policy.json"],
      message: "Production-significant surface must map to evidence fields or runtime commands.",
    })

    validateCommandList(surface.runtimeCommands || [], `production surface ${surface.id}`, packageJson, obligations, issues, warnings)
  }

  for (const key of requiredProductionKeys) {
    add(obligations, issues, warnings, {
      id: "obligations.production-config-key-covered-by-surface",
      subject: key,
      ok: coveredConfigKeys.has(key),
      evidence: [".ai/admin-control-panel-policy.json", ".ai/config-surface.json"],
      message: "Production-required config key must be mapped to a backend control panel production surface.",
    })
  }

  for (const command of productionCommands) {
    add(obligations, issues, warnings, {
      id: "obligations.production-evidence-command-covered-by-surface",
      subject: command,
      ok: coveredProductionCommands.has(command),
      evidence: [".ai/admin-control-panel-policy.json", ".ai/evidence-policy.json"],
      message: "Production evidence command must be mapped to a backend control panel production surface.",
    })
  }
}

function validateSystemFlowObligations(input) {
  const { systemMap, packageJson, obligations, issues, warnings } = input
  const nodes = new Map((systemMap.nodes || []).map((node) => [node.id, node]))

  for (const flow of systemMap.flows || []) {
    const flowNodes = [flow.from, ...(flow.through || []), flow.to].filter(Boolean)

    add(obligations, issues, warnings, {
      id: "obligations.system-flow-has-evidence",
      subject: flow.id,
      ok: Array.isArray(flow.evidence) && flow.evidence.length > 0,
      evidence: flow.evidence || [],
      message: "System flow must declare machine evidence.",
    })
    validateCommandList(flow.evidence || [], `system flow ${flow.id}`, packageJson, obligations, issues, warnings)

    for (const nodeId of flowNodes) {
      const node = nodes.get(nodeId)

      add(obligations, issues, warnings, {
        id: "obligations.system-flow-node-has-verification",
        subject: `${flow.id}:${nodeId}`,
        ok: Boolean(node) && Array.isArray(node.verification || node.evidence) && (node.verification || node.evidence).length > 0,
        evidence: node?.verification || node?.evidence || [],
        message: "Every node referenced by a system flow must carry verification or evidence.",
      })
    }
  }
}

function validateDiffObligations(input) {
  const {
    policy,
    baseline,
    productionConfig,
    compareRef,
    changedFiles,
    obligations,
    issues,
    warnings,
  } = input

  add(obligations, issues, warnings, {
    id: "obligations.changed-files-observed",
    subject: "git diff",
    ok: true,
    evidence: changedFiles.slice(0, 20),
    message: "Changed files were observed so obligations can be tied to repository drift.",
  })

  if (!compareRef) {
    return
  }

  const previousBaseline = readJsonFromGit(compareRef, ".ai/inventory-baseline.json", warnings)
  const requiredFields = policy?.diff?.newInventoryEntryRequiredFields || []

  if (previousBaseline?.tracked) {
    for (const [type, entries] of Object.entries(baseline.tracked || {})) {
      const previousValues = new Set(
        (previousBaseline.tracked[type] || []).map((entry) => trackedValue(entry))
      )

      for (const entry of entries || []) {
        const value = trackedValue(entry)

        if (!value || previousValues.has(value)) {
          continue
        }

        for (const field of requiredFields) {
          const valid = Array.isArray(entry?.[field])
            ? entry[field].length > 0
            : Boolean(entry?.[field])

          add(obligations, issues, warnings, {
            id: "obligations.new-inventory-entry-metadata",
            subject: `${type}:${value}:${field}`,
            ok: valid,
            evidence: [".ai/inventory-baseline.json", compareRef],
            message: "PR-added inventory baseline entry must declare required obligation metadata.",
          })
        }
      }
    }
  }

  const previousProduction = readJsonFromGit(compareRef, ".ai/production-readiness.json", warnings)
  const previousDebt = collectAcceptedBodyDebt(previousProduction)
  const currentDebt = collectAcceptedBodyDebt(productionConfig)

  for (const debtKey of currentDebt) {
    add(obligations, issues, warnings, {
      id: "obligations.new-body-validation-debt-blocked",
      subject: debtKey,
      ok: previousDebt.has(debtKey),
      evidence: [".ai/production-readiness.json", compareRef],
      message: "New accepted body-validation debt is blocked by obligations.",
    })
  }
}

function collectAcceptedBodyDebt(config) {
  const debt = new Set()

  for (const route of config?.routeContract?.routes || []) {
    for (const [method, validation] of Object.entries(route.bodyValidation || {})) {
      if (validation?.kind === "accepted-debt") {
        debt.add(`${route.path}#${method}`)
      }
    }
  }

  return debt
}

function summarize(obligations) {
  const byStatus = obligations.reduce((acc, obligation) => {
    acc[obligation.status] = (acc[obligation.status] || 0) + 1
    return acc
  }, {})
  const byId = obligations.reduce((acc, obligation) => {
    acc[obligation.id] = (acc[obligation.id] || 0) + 1
    return acc
  }, {})

  return { byStatus, byId }
}

export function createObligationsReport() {
  const issues = []
  const warnings = []
  const obligations = []
  const policy = safeReadJson(POLICY_PATH, issues)
  const system = safeReadJson(".ai/system.json", issues)
  const systemMap = safeReadJson(".ai/system-map.json", issues)
  const evidencePolicy = safeReadJson(".ai/evidence-policy.json", issues)
  const adminPolicy = safeReadJson(".ai/admin-control-panel-policy.json", issues)
  const configSurface = safeReadJson(".ai/config-surface.json", issues)
  const baseline = safeReadJson(".ai/inventory-baseline.json", issues)
  const productionConfig = safeReadJson(".ai/production-readiness.json", issues)
  const packageJson = safeReadJson("package.json", issues)
  const inventoryReport = createInventoryReport()
  const productionReport = createProductionReadinessReport()
  const configReport = createConfigSurfaceReport()
  const compareRef = process.env[policy?.diff?.compareRefEnv || "AI_BASELINE_COMPARE_REF"] || ""
  const changedFiles = collectChangedFiles(compareRef)

  validatePolicy(policy, packageJson, obligations, issues, warnings)
  validateCommandList(system.coldStart?.runFirst || [], "cold start runFirst", packageJson, obligations, issues, warnings)
  validatePatchObligations({
    obligations,
    issues,
    warnings,
  })
  validateInventoryObligations({
    baseline,
    inventoryReport,
    productionReport,
    packageJson,
    obligations,
    issues,
    warnings,
  })
  validateProductionObligations({
    policy,
    productionReport,
    configReport,
    obligations,
    issues,
    warnings,
  })
  validateControlPanelObligations({
    adminPolicy,
    configSurface,
    evidencePolicy,
    packageJson,
    obligations,
    issues,
    warnings,
  })
  validateSystemFlowObligations({
    systemMap,
    packageJson,
    obligations,
    issues,
    warnings,
  })
  validateDiffObligations({
    policy,
    baseline,
    productionConfig,
    compareRef,
    changedFiles,
    obligations,
    issues,
    warnings,
  })

  return {
    ok: issues.length === 0,
    generatedAt: new Date().toISOString(),
    compareRef: compareRef || null,
    issueCount: issues.length,
    warningCount: warnings.length,
    obligationCount: obligations.length,
    summary: summarize(obligations),
    changedFiles,
    issues,
    warnings,
    obligations,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = createObligationsReport()
  const args = new Set(process.argv.slice(2))
  const output = args.has("--full") || !report.ok
    ? report
    : {
      ok: report.ok,
      generatedAt: report.generatedAt,
      compareRef: report.compareRef,
      issueCount: report.issueCount,
      warningCount: report.warningCount,
      obligationCount: report.obligationCount,
      summary: report.summary,
      changedFiles: report.changedFiles,
      issues: report.issues,
      warnings: report.warnings,
      omittedObligationDetails: report.obligations.length,
    }

  console.log(JSON.stringify(output, null, 2))

  if (!report.ok) {
    process.exit(1)
  }
}
