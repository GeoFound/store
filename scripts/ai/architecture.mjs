import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { cruise } from "dependency-cruiser"
import ts from "typescript"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const issues = []
const warnings = []

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"))
  } catch (error) {
    issues.push({
      id: "architecture-rules.invalid",
      path: relativePath,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function normalizePath(value) {
  return value.split(path.sep).join("/")
}

function sourceFiles(relativeDir, ignorePathSegments = []) {
  const absoluteDir = path.join(root, relativeDir)

  if (!fs.existsSync(absoluteDir)) {
    return []
  }

  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = normalizePath(path.join(relativeDir, entry.name))
    const normalizedForMatch = `/${relativePath}`

    if (ignorePathSegments.some((segment) => normalizedForMatch.includes(segment))) {
      return []
    }

    if (entry.isDirectory()) {
      return sourceFiles(relativePath, ignorePathSegments)
    }

    return entry.isFile() && /\.(ts|tsx|mts|mjs|js|jsx)$/.test(entry.name)
      ? [relativePath]
      : []
  })
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

function addFinding(severity, finding) {
  const target = severity === "issue" ? issues : warnings
  target.push(finding)
}

function lineCount(source) {
  return source.split("\n").length
}

function localFunctionCount(source) {
  const functionDeclarations =
    source.match(/(?:^|\n)\s*function\s+[A-Za-z0-9_$]+\s*\(/g) || []
  const functionExpressions =
    source.match(
      /(?:^|\n)\s*(?:const|let|var)\s+[A-Za-z0-9_$]+\s*=\s*(?:async\s*)?function\b/g
    ) || []
  const arrowFunctions =
    source.match(
      /(?:^|\n)\s*(?:const|let|var)\s+[A-Za-z0-9_$]+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/g
    ) || []

  return functionDeclarations.length + functionExpressions.length + arrowFunctions.length
}

function importSpecifiers(source) {
  const specs = []
  const patterns = [
    /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specs.push(match[1])
    }
  }

  return specs
}

async function runDependencyCruise() {
  try {
    const result = await cruise(
      [
      "apps/backend/src/modules",
      "apps/backend/src/api",
      "apps/backend/src/utils",
      "apps/storefront/src",
      ],
      {
        outputType: "json",
        exclude: {
          path: "node_modules|\\.test\\.|\\.spec\\.|__tests__|/migrations/",
        },
        baseDir: root,
        tsPreCompilationDeps: true,
      }
    )

    return typeof result.output === "string" ? JSON.parse(result.output) : result.output
  } catch (error) {
    addFinding("issue", {
      id: "dependency-cruiser.failed",
      message: "dependency-cruiser failed while building the architecture dependency graph.",
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    })
    return null
  }
}

function dependencyIndex(graph) {
  const index = new Map()
  const sources = new Set()

  for (const module of graph?.modules || []) {
    if (!module?.source || !Array.isArray(module.dependencies)) {
      continue
    }

    sources.add(module.source)
    index.set(module.source, module.dependencies)
  }

  return { index, sources }
}

function dependencySpecifiers(file, source, dependencyGraph) {
  if (dependencyGraph?.sources.has(file)) {
    return (dependencyGraph.index.get(file) || []).map((dependency) => ({
      specifier: dependency.module,
      target: normalizePath(dependency.resolved || resolveImportTarget(file, dependency.module)),
    }))
  }

  return importSpecifiers(source).map((specifier) => ({
    specifier,
    target: resolveImportTarget(file, specifier),
  }))
}

function resolveImportTarget(file, specifier) {
  if (!specifier.startsWith(".")) {
    return specifier
  }

  return normalizePath(path.normalize(path.join(path.dirname(file), specifier)))
}

function isWithin(target, boundary) {
  return target === boundary || target.startsWith(`${boundary}/`)
}

function backendModuleName(relativePath) {
  const parts = normalizePath(relativePath).split("/")
  const moduleIndex = parts.indexOf("modules")

  return moduleIndex >= 0 ? parts[moduleIndex + 1] || "" : ""
}

function inspectBackendModules(rules, dependencyGraph) {
  const backend = rules.backend || {}
  const modulesRoot = backend.modulesRoot || "apps/backend/src/modules"
  const moduleWarnings = backend.moduleWarnings || {}
  const ignorePathSegments = backend.ignorePathSegments || []
  const files = sourceFiles(modulesRoot, ignorePathSegments)

  for (const file of files) {
    const source = readText(file)
    const currentModule = backendModuleName(file)

    for (const dependency of dependencySpecifiers(file, source, dependencyGraph)) {
      const specifier = dependency.specifier
      const target = dependency.target

      if (
        moduleWarnings.importsPlatformAdapters &&
        isWithin(target, "apps/backend/src/platform-adapters")
      ) {
        addFinding("warning", {
          id: "backend-module-imports-platform-adapters",
          path: file,
          import: specifier,
          message:
            "Backend module imports platform-adapters. Prefer platform contracts or move backend binding to the adapter layer.",
        })
      }

      if (moduleWarnings.importsOtherModules && isWithin(target, modulesRoot)) {
        const importedModule = backendModuleName(target)

        if (importedModule && importedModule !== currentModule) {
          addFinding("warning", {
            id: "backend-module-imports-other-module",
            path: file,
            import: specifier,
            fromModule: currentModule,
            toModule: importedModule,
            message:
              "Backend module imports another module directly. Prefer a platform port, hook, event, or adapter-owned service resolution.",
          })
        }
      }
    }

    if (file.endsWith("/service.ts") && lineCount(source) > moduleWarnings.serviceMaxLines) {
      addFinding("warning", {
        id: "backend-module-service-large",
        path: file,
        lines: lineCount(source),
        maxLines: moduleWarnings.serviceMaxLines,
        message:
          "Module service is large enough to justify extracting focused domain helpers or policies.",
      })
    }

    if (file.endsWith("/provider.ts") && lineCount(source) > moduleWarnings.providerMaxLines) {
      addFinding("warning", {
        id: "backend-module-provider-large",
        path: file,
        lines: lineCount(source),
        maxLines: moduleWarnings.providerMaxLines,
        message:
          "Provider is large enough to justify extracting protocol/client mapping helpers.",
      })
    }
  }
}

function inspectBackendUtils(rules, dependencyGraph) {
  const backend = rules.backend || {}
  const utilsRoot = backend.utilsRoot || "apps/backend/src/utils"
  const utilsWarnings = backend.utilsWarnings || {}
  const files = sourceFiles(utilsRoot, backend.ignorePathSegments || [])

  for (const file of files) {
    const source = readText(file)

    for (const dependency of dependencySpecifiers(file, source, dependencyGraph)) {
      const specifier = dependency.specifier
      const target = dependency.target

      if (
        utilsWarnings.importsPlatformAdapters &&
        isWithin(target, "apps/backend/src/platform-adapters")
      ) {
        addFinding("warning", {
          id: "backend-utils-import-platform-adapters",
          path: file,
          import: specifier,
          message:
            "Shared backend util imports platform-adapters. Prefer keeping adapter resolution at API, workflow, or adapter boundaries.",
        })
      }

      if (utilsWarnings.importsModules && isWithin(target, "apps/backend/src/modules")) {
        addFinding("warning", {
          id: "backend-utils-import-modules",
          path: file,
          import: specifier,
          message:
            "Shared backend util imports module internals. Prefer platform contracts or locally defined input types.",
        })
      }
    }
  }
}

function inspectApiRoutes(rules, dependencyGraph) {
  const backend = rules.backend || {}
  const apiRoot = backend.apiRoot || "apps/backend/src/api"
  const routeBudgets = backend.apiRouteBudgets || {}
  const files = sourceFiles(apiRoot, backend.ignorePathSegments || []).filter((file) =>
    file.endsWith("/route.ts")
  )

  for (const file of files) {
    const source = readText(file)
    const lines = lineCount(source)
    const helpers = localFunctionCount(source)

    if (routeBudgets.maxLines && lines > routeBudgets.maxLines) {
      addFinding("warning", {
        id: "api-route-large",
        path: file,
        lines,
        maxLines: routeBudgets.maxLines,
        message:
          "API route is large enough to consider moving query shaping or domain orchestration into a focused helper.",
      })
    }

    if (routeBudgets.maxLocalFunctions && helpers > routeBudgets.maxLocalFunctions) {
      addFinding("warning", {
        id: "api-route-many-local-functions",
        path: file,
        localFunctions: helpers,
        maxLocalFunctions: routeBudgets.maxLocalFunctions,
        message:
          "API route has many local helper functions. Consider extracting a query/service helper before adding more behavior.",
      })
    }

    if (routeBudgets.warnOnDirectQueryResolve && source.includes("ContainerRegistrationKeys.QUERY")) {
      addFinding("warning", {
        id: "api-route-direct-query-resolve",
        path: file,
        message:
          "API route resolves the Medusa query graph directly. Keep an eye on this and extract reusable query helpers when behavior grows.",
      })
    }

    if (routeBudgets.warnOnModuleImports) {
      for (const dependency of dependencySpecifiers(file, source, dependencyGraph)) {
        const specifier = dependency.specifier
        const target = dependency.target

        if (isWithin(target, "apps/backend/src/modules")) {
          addFinding("warning", {
            id: "api-route-imports-module-internals",
            path: file,
            import: specifier,
            message:
              "API route imports module internals. Prefer platform-adapter service access or stable platform/input contracts.",
          })
        }
      }
    }
  }
}

function inspectHotspotFiles(rules) {
  for (const hotspot of rules.backend?.hotspotFiles || []) {
    if (!exists(hotspot.path)) {
      addFinding("issue", {
        id: "hotspot-file-missing",
        path: hotspot.path,
        message: "Architecture hotspot file does not exist.",
      })
      continue
    }

    const source = readText(hotspot.path)
    const lines = lineCount(source)

    if (hotspot.maxLines && lines > hotspot.maxLines) {
      addFinding("warning", {
        id: "hotspot-file-large",
        path: hotspot.path,
        lines,
        maxLines: hotspot.maxLines,
        reason: hotspot.reason,
        message:
          "Architecture hotspot exceeded its line budget. Split cohesive policy/configuration pieces before expanding it further.",
      })
    }
  }
}

function inspectStorefront(rules) {
  const storefront = rules.storefront || {}
  const sourceRoot = storefront.sourceRoot || "apps/storefront/src"
  const allowedFetchFiles = new Set(storefront.allowedFetchFiles || [])
  const files = sourceFiles(sourceRoot, ["/__tests__/", ".test.", ".spec."])

  for (const file of files) {
    const source = readText(file)
    const allowed = allowedFetchFiles.has(file)
    const storefrontUsage = inspectStorefrontSource(file, source)

    if (!allowed && storefrontUsage.usesFetch) {
      addFinding("warning", {
        id: "storefront-fetch-outside-commerce-adapter",
        path: file,
        message:
          "Storefront source calls fetch outside the commerce adapter. UI should normally use the commerce port.",
      })
    }

    if (!allowed && storefrontUsage.referencesStoreApi) {
      addFinding("warning", {
        id: "storefront-store-api-outside-commerce-adapter",
        path: file,
        message:
          "Storefront source references store API paths outside the commerce adapter. Keep backend coupling inside the commerce adapter.",
      })
    }
  }
}

function inspectStorefrontSource(file, source) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind(file))
  const fetchAliases = new Set()
  let usesFetch = false
  let referencesStoreApi = false

  function markFetchAlias(name) {
    if (name) {
      fetchAliases.add(name)
    }
  }

  function inspectBindingPattern(name, initializer) {
    if (!ts.isObjectBindingPattern(name) || !isGlobalObjectExpression(initializer)) {
      return
    }

    for (const element of name.elements) {
      const propertyName = element.propertyName || element.name

      if (
        ts.isIdentifier(propertyName) &&
        propertyName.text === "fetch" &&
        ts.isIdentifier(element.name)
      ) {
        markFetchAlias(element.name.text)
      }
    }
  }

  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isIdentifier(node.name) && isFetchExpression(node.initializer, fetchAliases)) {
        markFetchAlias(node.name.text)
        usesFetch = true
      }

      inspectBindingPattern(node.name, node.initializer)
    }

    if (ts.isCallExpression(node) && isFetchExpression(node.expression, fetchAliases)) {
      usesFetch = true
    }

    if (literalText(node)?.includes("/store/")) {
      referencesStoreApi = true
    }

    if (ts.isTemplateExpression(node)) {
      const templateText = [
        node.head.text,
        ...node.templateSpans.map((span) => span.literal.text),
      ].join("")

      if (templateText.includes("/store/")) {
        referencesStoreApi = true
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return { usesFetch, referencesStoreApi }
}

function scriptKind(file) {
  if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
    return ts.ScriptKind.TSX
  }

  return ts.ScriptKind.TS
}

function literalText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }

  return null
}

function isGlobalObjectExpression(node) {
  return (
    (ts.isIdentifier(node) && node.text === "globalThis") ||
    (ts.isIdentifier(node) && node.text === "window")
  )
}

function isFetchExpression(node, aliases) {
  if (ts.isIdentifier(node)) {
    return node.text === "fetch" || aliases.has(node.text)
  }

  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text === "fetch" && isGlobalObjectExpression(node.expression)
  }

  if (ts.isElementAccessExpression(node)) {
    return isGlobalObjectExpression(node.expression) && literalText(node.argumentExpression) === "fetch"
  }

  return false
}

function inspectSkill(rules) {
  const skill = rules.skill || {}

  if (skill.required && !exists(skill.path)) {
    addFinding("issue", {
      id: "store-maintainer-skill-missing",
      path: skill.path,
      message: "Repository AI maintainer skill is required.",
    })
  }
}

function summarizeFindings(findings) {
  return findings.reduce((acc, finding) => {
    acc[finding.id] = (acc[finding.id] || 0) + 1
    return acc
  }, {})
}

function findingFingerprint(finding) {
  return [
    finding.id,
    finding.path || "",
    finding.import || "",
    finding.fromModule || "",
    finding.toModule || "",
  ].join("|")
}

function validateWarningBaseline(rules) {
  const baselinePath = rules.baseline?.path || ".ai/architecture-baseline.json"
  let baseline = null

  try {
    baseline = JSON.parse(fs.readFileSync(path.join(root, baselinePath), "utf8"))
  } catch (error) {
    addFinding("issue", {
      id: "architecture-baseline.invalid",
      path: baselinePath,
      message:
        error instanceof Error ? error.message : "Architecture baseline is invalid.",
    })
    return
  }

  const acceptedWarnings = new Map(
    (baseline.acceptedWarnings || []).map((entry) => [
      entry.fingerprint || findingFingerprint(entry),
      entry,
    ])
  )
  // Snapshot the real architecture findings produced by the inspect* passes
  // before the baseline metadata/growth checks run. Those checks may append
  // their own governance warnings (e.g. compare-ref-unavailable) to warnings[],
  // and those meta warnings must never be re-classified as un-baselined code debt.
  const findingWarnings = [...warnings]
  validateBaselineMetadata(baseline, baselinePath)
  validateBaselineGrowth(baseline, baselinePath)
  const seen = new Set()

  for (const warning of findingWarnings) {
    const fingerprint = findingFingerprint(warning)
    const baselineEntry = acceptedWarnings.get(fingerprint)

    warning.fingerprint = fingerprint

    if (!baselineEntry) {
      addFinding("issue", {
        id: "architecture.unbaselined-warning",
        path: warning.path,
        fingerprint,
        warningId: warning.id,
        message:
          "Architecture warning is not in the accepted baseline. Fix it or explicitly update .ai/architecture-baseline.json with rationale.",
      })
      continue
    }

    seen.add(fingerprint)
    warning.baseline = {
      accepted: true,
      owner: baselineEntry.owner,
      target: baselineEntry.target,
      expiresAt: baselineEntry.expiresAt,
    }

    if (
      typeof baselineEntry.maxObservedLines === "number" &&
      typeof warning.lines === "number" &&
      warning.lines > baselineEntry.maxObservedLines
    ) {
      addFinding("issue", {
        id: "architecture.baselined-file-grew",
        path: warning.path,
        fingerprint,
        currentLines: warning.lines,
        maxObservedLines: baselineEntry.maxObservedLines,
        message:
          "Baselined architecture debt grew. Split or reduce it before adding more behavior.",
      })
    }

    if (
      typeof baselineEntry.maxObservedLocalFunctions === "number" &&
      typeof warning.localFunctions === "number" &&
      warning.localFunctions > baselineEntry.maxObservedLocalFunctions
    ) {
      addFinding("issue", {
        id: "architecture.baselined-route-grew",
        path: warning.path,
        fingerprint,
        currentLocalFunctions: warning.localFunctions,
        maxObservedLocalFunctions: baselineEntry.maxObservedLocalFunctions,
        message:
          "Baselined route complexity grew. Extract helpers before adding more local route logic.",
      })
    }
  }

  for (const [fingerprint, entry] of acceptedWarnings.entries()) {
    if (!seen.has(fingerprint)) {
      addFinding("warning", {
        id: "architecture-baseline.stale-entry",
        path: entry.path,
        fingerprint,
        message:
          "Architecture baseline entry is no longer observed. Remove it after confirming the debt was intentionally paid down.",
      })
    }
  }
}

function validateBaselineMetadata(baseline, baselinePath) {
  if (!baseline?.policy || typeof baseline.policy !== "object") {
    addFinding("issue", {
      id: "architecture-baseline.policy-missing",
      path: baselinePath,
      message: "Architecture baseline must declare a policy object.",
    })
  }

  if (
    typeof baseline?.policy?.maxAcceptedWarnings === "number" &&
    (baseline.acceptedWarnings || []).length > baseline.policy.maxAcceptedWarnings
  ) {
    addFinding("issue", {
      id: "architecture-baseline.warning-budget-exceeded",
      path: baselinePath,
      current: (baseline.acceptedWarnings || []).length,
      maxAcceptedWarnings: baseline.policy.maxAcceptedWarnings,
      message: "Architecture baseline accepted warning count exceeded its configured budget.",
    })
  }

  const today = new Date().toISOString().slice(0, 10)
  const seen = new Set()

  for (const entry of baseline.acceptedWarnings || []) {
    const fingerprint = entry.fingerprint || findingFingerprint(entry)

    if (seen.has(fingerprint)) {
      addFinding("issue", {
        id: "architecture-baseline.duplicate-fingerprint",
        path: entry.path || baselinePath,
        fingerprint,
        message: "Architecture baseline contains a duplicate fingerprint.",
      })
    }
    seen.add(fingerprint)

    for (const field of ["fingerprint", "path", "target", "owner", "rationale", "expiresAt"]) {
      if (!entry[field]) {
        addFinding("issue", {
          id: "architecture-baseline.entry-metadata-missing",
          path: entry.path || baselinePath,
          fingerprint,
          field,
          message:
            "Architecture baseline entries must declare fingerprint, path, target, owner, rationale, and expiresAt.",
        })
      }
    }

    if (entry.expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(entry.expiresAt)) {
      addFinding("issue", {
        id: "architecture-baseline.expiry-invalid",
        path: entry.path || baselinePath,
        fingerprint,
        expiresAt: entry.expiresAt,
        message: "Architecture baseline expiresAt must be an ISO date string: YYYY-MM-DD.",
      })
    } else if (entry.expiresAt && entry.expiresAt < today) {
      addFinding("issue", {
        id: "architecture-baseline.expired",
        path: entry.path || baselinePath,
        fingerprint,
        expiresAt: entry.expiresAt,
        message: "Architecture baseline entry expired. Fix the debt or renew it with a current rationale.",
      })
    }
  }
}

function validateBaselineGrowth(baseline, baselinePath) {
  const compareRef = process.env.AI_BASELINE_COMPARE_REF

  if (!compareRef) {
    return
  }

  const previous = spawnSync("git", ["show", `${compareRef}:${baselinePath}`], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    maxBuffer: 4 * 1024 * 1024,
  })

  if (previous.status !== 0 || !previous.stdout.trim()) {
    addFinding("warning", {
      id: "architecture-baseline.compare-ref-unavailable",
      path: baselinePath,
      compareRef,
      message: "Could not read previous architecture baseline from AI_BASELINE_COMPARE_REF.",
    })
    return
  }

  let previousBaseline = null

  try {
    previousBaseline = JSON.parse(previous.stdout)
  } catch (error) {
    addFinding("issue", {
      id: "architecture-baseline.compare-ref-invalid",
      path: baselinePath,
      compareRef,
      message: error instanceof Error ? error.message : "Previous architecture baseline is invalid JSON.",
    })
    return
  }

  const previousFingerprints = new Set(
    (previousBaseline.acceptedWarnings || []).map((entry) => entry.fingerprint || findingFingerprint(entry))
  )

  for (const entry of baseline.acceptedWarnings || []) {
    const fingerprint = entry.fingerprint || findingFingerprint(entry)

    if (!previousFingerprints.has(fingerprint)) {
      addFinding("issue", {
        id: "architecture-baseline.new-fingerprint-blocked",
        path: entry.path || baselinePath,
        fingerprint,
        compareRef,
        message:
          "Architecture baseline gained a new accepted warning compared with AI_BASELINE_COMPARE_REF. Fix the debt instead of baselining it in this PR.",
      })
    }
  }
}

export async function createArchitectureReport() {
  issues.length = 0
  warnings.length = 0

  const rules = readJson(".ai/architecture-rules.json")
  let graph = null

  if (rules) {
    graph = await runDependencyCruise()
    const dependencyGraph = graph ? dependencyIndex(graph) : null

    inspectSkill(rules)
    inspectBackendModules(rules, dependencyGraph)
    inspectBackendUtils(rules, dependencyGraph)
    inspectApiRoutes(rules, dependencyGraph)
    inspectHotspotFiles(rules)
    inspectStorefront(rules)
    validateWarningBaseline(rules)
  }

  return {
    ok: issues.length === 0,
    generatedAt: new Date().toISOString(),
    issueCount: issues.length,
    warningCount: warnings.length,
    summary: {
      issuesById: summarizeFindings(issues),
      warningsById: summarizeFindings(warnings),
      dependencyGraph: {
        tool: "dependency-cruiser",
        totalCruised: graph?.summary?.totalCruised || 0,
        totalDependenciesCruised: graph?.summary?.totalDependenciesCruised || 0,
      },
    },
    issues,
    warnings,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await createArchitectureReport()

  console.log(JSON.stringify(report, null, 2))

  if (!report.ok) {
    process.exit(1)
  }
}
