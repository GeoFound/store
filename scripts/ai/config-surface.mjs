import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

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

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

function sourceFiles(relativeDir, ignoreSegments = []) {
  const absoluteDir = path.join(root, relativeDir)

  if (!fs.existsSync(absoluteDir)) {
    return []
  }

  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name)
    const normalizedPath = `/${relativePath.replaceAll(path.sep, "/")}`

    if (ignoreSegments.some((segment) => normalizedPath.includes(segment))) {
      return []
    }

    if (entry.isDirectory()) {
      return sourceFiles(relativePath, ignoreSegments)
    }

    return entry.isFile() && /\.(ts|tsx|mts|mjs|js|jsx)$/.test(entry.name)
      ? [relativePath]
      : []
  })
}

function findEnvReads(config) {
  const envReads = new Map()
  const dynamicEnvReads = []
  const sourceRoots = config?.scan?.sourceRoots || []
  const ignoreSegments = [
    ...(config?.scan?.ignorePathSegments || []),
    "/__tests__/",
    ".test.",
    ".spec.",
  ]

  for (const sourceRoot of sourceRoots) {
    for (const file of sourceFiles(sourceRoot, ignoreSegments)) {
      const source = readText(file)
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind(file))
      const constants = collectStringConstants(sourceFile)
      const envAliases = collectEnvAliases(sourceFile)

      function recordEnvRead(key) {
        if (!key) {
          return
        }

        const entries = envReads.get(key) || []
        entries.push(file)
        envReads.set(key, entries)
      }

      function visit(node) {
        if (
          ts.isVariableDeclaration(node) &&
          node.initializer &&
          ts.isObjectBindingPattern(node.name) &&
          isEnvObjectExpression(node.initializer, envAliases)
        ) {
          for (const key of envKeysFromBindingPattern(node.name)) {
            recordEnvRead(key)
          }
        }

        if (ts.isPropertyAccessExpression(node) && isEnvObjectExpression(node.expression, envAliases)) {
          recordEnvRead(node.name.text)
        }

        if (ts.isElementAccessExpression(node) && isEnvObjectExpression(node.expression, envAliases)) {
          const key = staticStringValue(node.argumentExpression, constants)

          if (key) {
            recordEnvRead(key)
          } else {
            dynamicEnvReads.push({
              file,
              expression: node.getText(sourceFile),
            })
          }
        }

        ts.forEachChild(node, visit)
      }

      visit(sourceFile)
    }
  }

  return { envReads, dynamicEnvReads }
}

function scriptKind(file) {
  if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
    return ts.ScriptKind.TSX
  }

  return ts.ScriptKind.TS
}

function collectStringConstants(sourceFile) {
  const constants = new Map()

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const value = staticStringValue(node.initializer, constants)

      if (value) {
        constants.set(node.name.text, value)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return constants
}

function collectEnvAliases(sourceFile) {
  const aliases = new Set()

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isEnvAliasInitializer(node.initializer)
    ) {
      aliases.add(node.name.text)
    }

    if (
      ts.isParameter(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isEnvAliasInitializer(node.initializer)
    ) {
      aliases.add(node.name.text)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return aliases
}

function isEnvAliasInitializer(node) {
  if (isProcessEnvExpression(node)) {
    return true
  }

  if (ts.isParenthesizedExpression(node)) {
    return isEnvAliasInitializer(node.expression)
  }

  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) {
    return isEnvAliasInitializer(node.expression)
  }

  if (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
  ) {
    return isEnvAliasInitializer(node.left) || isEnvAliasInitializer(node.right)
  }

  return false
}

function isProcessEnvExpression(node) {
  if (!ts.isPropertyAccessExpression(node) || node.name.text !== "env") {
    return false
  }

  const expression = node.expression

  return (
    (ts.isIdentifier(expression) && expression.text === "process") ||
    (ts.isPropertyAccessExpression(expression) &&
      expression.name.text === "process" &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === "globalThis")
  )
}

function isEnvObjectExpression(node, aliases) {
  if (isProcessEnvExpression(node)) {
    return true
  }

  return ts.isIdentifier(node) && aliases.has(node.text)
}

function envKeysFromBindingPattern(pattern) {
  const keys = []

  for (const element of pattern.elements) {
    if (element.dotDotDotToken) {
      continue
    }

    const propertyName = element.propertyName || element.name

    if (ts.isIdentifier(propertyName) || ts.isStringLiteral(propertyName)) {
      keys.push(propertyName.text)
    }
  }

  return keys
}

function staticStringValue(node, constants) {
  if (!node) {
    return null
  }

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }

  if (ts.isIdentifier(node)) {
    return constants.get(node.text) || null
  }

  if (ts.isParenthesizedExpression(node)) {
    return staticStringValue(node.expression, constants)
  }

  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) {
    return staticStringValue(node.expression, constants)
  }

  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticStringValue(node.left, constants)
    const right = staticStringValue(node.right, constants)

    return left !== null && right !== null ? `${left}${right}` : null
  }

  if (ts.isTemplateExpression(node)) {
    let value = node.head.text

    for (const span of node.templateSpans) {
      const expressionValue = staticStringValue(span.expression, constants)

      if (expressionValue === null) {
        return null
      }

      value += expressionValue + span.literal.text
    }

    return value
  }

  return null
}

function envFileKeys(relativePath) {
  if (!exists(relativePath)) {
    return new Set()
  }

  return new Set(
    readText(relativePath)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.split("=")[0].trim())
      .filter(Boolean)
  )
}

function validateConfigSurface(config) {
  const entries = config?.entries || {}
  const entryKeys = Object.keys(entries)
  const scopes = new Set(["backend", "storefront", "shared", "infrastructure"])
  const visibility = new Set(["internal", "public", "public-origin", "secret"])

  if (!config || typeof config !== "object") {
    issues.push({
      id: "config-surface.invalid",
      message: "Config surface must be a JSON object.",
    })
    return
  }

  if (!entryKeys.length) {
    issues.push({
      id: "config-surface.entries-empty",
      message: "Config surface must declare entries.",
    })
  }

  for (const key of entryKeys) {
    const entry = entries[key]

    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      issues.push({
        id: "config-surface.key-invalid",
        key,
        message: "Config key must be uppercase snake case.",
      })
    }

    if (!scopes.has(entry?.scope)) {
      issues.push({
        id: "config-surface.scope-invalid",
        key,
        scope: entry?.scope,
        message: "Config entry has invalid scope.",
      })
    }

    if (!visibility.has(entry?.visibility)) {
      issues.push({
        id: "config-surface.visibility-invalid",
        key,
        visibility: entry?.visibility,
        message: "Config entry has invalid visibility.",
      })
    }

    if (!entry?.owner) {
      issues.push({
        id: "config-surface.owner-missing",
        key,
        message: "Config entry must declare an owner.",
      })
    }

    if (typeof entry?.requiredInProduction !== "boolean") {
      issues.push({
        id: "config-surface.production-flag-invalid",
        key,
        message: "Config entry must declare requiredInProduction as boolean.",
      })
    }

    if (key.startsWith("NEXT_PUBLIC_") && entry?.visibility === "secret") {
      issues.push({
        id: "config-surface.public-secret",
        key,
        message: "NEXT_PUBLIC config cannot be secret.",
      })
    }

    if (key.startsWith("NEXT_PUBLIC_") && entry?.scope === "backend") {
      issues.push({
        id: "config-surface.public-backend-scope",
        key,
        message: "NEXT_PUBLIC config must not control backend scope.",
      })
    }
  }

  validateDynamicScanPolicy(config)
}

function validateDynamicScanPolicy(config) {
  for (const pattern of config?.scan?.allowedDynamicPatterns || []) {
    if (!pattern.pattern) {
      issues.push({
        id: "config-surface.dynamic-pattern-invalid",
        message: "Allowed dynamic env pattern must declare pattern.",
      })
      continue
    }

    try {
      new RegExp(pattern.pattern)
    } catch (error) {
      issues.push({
        id: "config-surface.dynamic-pattern-invalid",
        pattern: pattern.pattern,
        message: error instanceof Error ? error.message : "Allowed dynamic env pattern is invalid.",
      })
    }

    for (const field of ["owner", "scope", "rationale"]) {
      if (!pattern[field]) {
        issues.push({
          id: "config-surface.dynamic-pattern-metadata-missing",
          pattern: pattern.pattern,
          field,
          message: "Allowed dynamic env patterns must declare owner, scope, and rationale.",
        })
      }
    }

    if (!Array.isArray(pattern.verification) || pattern.verification.length === 0) {
      issues.push({
        id: "config-surface.dynamic-pattern-verification-missing",
        pattern: pattern.pattern,
        message: "Allowed dynamic env patterns must declare verification commands.",
      })
    }
  }

  for (const access of config?.scan?.allowedDynamicAccess || []) {
    for (const field of ["path", "owner", "rationale"]) {
      if (!access[field]) {
        issues.push({
          id: "config-surface.dynamic-access-metadata-missing",
          path: access.path,
          field,
          message: "Allowed dynamic env access must declare path, owner, and rationale.",
        })
      }
    }

    if (!Array.isArray(access.verification) || access.verification.length === 0) {
      issues.push({
        id: "config-surface.dynamic-access-verification-missing",
        path: access.path,
        message: "Allowed dynamic env access must declare verification commands.",
      })
    }
  }
}

function validateEnvReads(config) {
  const entries = config?.entries || {}
  const { envReads, dynamicEnvReads } = findEnvReads(config)
  const registeredKeys = new Set(Object.keys(entries))

  for (const [key, files] of envReads.entries()) {
    if (!registeredKeys.has(key) && !matchesAllowedDynamicPattern(key, config)) {
      issues.push({
        id: "config-surface.env-read-unregistered",
        key,
        files: Array.from(new Set(files)).sort(),
        message: "Application code reads an env key that is not registered in .ai/config-surface.json.",
      })
    }
  }

  for (const read of dynamicEnvReads) {
    if (!isAllowedDynamicAccess(read, config)) {
      issues.push({
        id: "config-surface.env-read-dynamic-unregistered",
        path: read.file,
        expression: read.expression,
        message:
          "Application code uses dynamic env access. Register the helper or dynamic key pattern in .ai/config-surface.json.",
      })
    }
  }

  return { envReads, dynamicEnvReads }
}

function matchesAllowedDynamicPattern(key, config) {
  return (config?.scan?.allowedDynamicPatterns || []).some((entry) => {
    try {
      return new RegExp(entry.pattern).test(key)
    } catch {
      return false
    }
  })
}

function isAllowedDynamicAccess(read, config) {
  return (config?.scan?.allowedDynamicAccess || []).some((entry) => entry.path === read.file)
}

function validateEnvExamples(config) {
  const entries = config?.entries || {}
  const backendLocal = envFileKeys("apps/backend/.env.template")
  const backendProduction = envFileKeys("ops/env/backend.production.env.example")
  const storefrontLocal = envFileKeys("apps/storefront/.env.example")
  const storefrontProduction = envFileKeys("ops/env/storefront.production.env.example")

  for (const [key, entry] of Object.entries(entries)) {
    if (entry.requiredInProduction !== true) {
      continue
    }

    const scope = entry.scope

    if ((scope === "backend" || scope === "shared") && !backendProduction.has(key)) {
      issues.push({
        id: "config-surface.production-backend-example-missing",
        key,
        message: "Production-required backend/shared config is missing from ops backend env example.",
      })
    }

    if ((scope === "storefront" || scope === "shared") && !storefrontProduction.has(key)) {
      issues.push({
        id: "config-surface.production-storefront-example-missing",
        key,
        message: "Production-required storefront/shared config is missing from ops storefront env example.",
      })
    }

    if ((scope === "backend" || scope === "shared") && !backendLocal.has(key)) {
      warnings.push({
        id: "config-surface.local-backend-example-missing",
        key,
        message: "Production-required backend/shared config is missing from backend local env template.",
      })
    }

    if ((scope === "storefront" || scope === "shared") && !storefrontLocal.has(key)) {
      warnings.push({
        id: "config-surface.local-storefront-example-missing",
        key,
        message: "Production-required storefront/shared config is missing from storefront local env example.",
      })
    }
  }
}

function validateProfiles() {
  const profilesRoot = path.join(root, "profiles/sites")

  if (!fs.existsSync(profilesRoot)) {
    issues.push({
      id: "tenancy.profiles-root-missing",
      message: "profiles/sites is required.",
    })
    return
  }

  for (const siteId of fs.readdirSync(profilesRoot).sort()) {
    const sitePath = path.join(profilesRoot, siteId)

    if (!fs.statSync(sitePath).isDirectory()) {
      continue
    }

    for (const siteEnv of fs.readdirSync(sitePath).sort()) {
      const profilePath = path.join(sitePath, siteEnv, "site.json")

      if (!fs.existsSync(profilePath)) {
        continue
      }

      const relativePath = path.relative(root, profilePath)
      const profile = readJson(relativePath)
      const tenancy = profile?.tenancy

      if (!tenancy || typeof tenancy !== "object") {
        issues.push({
          id: "tenancy.profile-missing",
          path: relativePath,
          message: "Site profile must declare tenancy.",
        })
        continue
      }

      if (!["dedicated", "pooled", "sharded"].includes(tenancy.mode)) {
        issues.push({
          id: "tenancy.mode-invalid",
          path: relativePath,
          mode: tenancy.mode,
          message: "tenancy.mode must be dedicated, pooled, or sharded.",
        })
      }

      if (!["isolated", "shared", "sharded"].includes(tenancy.data_plane)) {
        issues.push({
          id: "tenancy.data-plane-invalid",
          path: relativePath,
          dataPlane: tenancy.data_plane,
          message: "tenancy.data_plane must be isolated, shared, or sharded.",
        })
      }

      if (!["profile", "shared"].includes(tenancy.control_plane)) {
        issues.push({
          id: "tenancy.control-plane-invalid",
          path: relativePath,
          controlPlane: tenancy.control_plane,
          message: "tenancy.control_plane must be profile or shared.",
        })
      }

      if (tenancy.mode === "dedicated" && tenancy.data_plane !== "isolated") {
        issues.push({
          id: "tenancy.dedicated-data-plane-invalid",
          path: relativePath,
          message: "Dedicated sites must use an isolated data plane.",
        })
      }

      if (tenancy.mode === "pooled" && tenancy.data_plane !== "shared") {
        issues.push({
          id: "tenancy.pooled-data-plane-invalid",
          path: relativePath,
          message: "Pooled sites must use a shared data plane.",
        })
      }

      if (tenancy.mode === "sharded" && tenancy.data_plane !== "sharded") {
        issues.push({
          id: "tenancy.sharded-data-plane-invalid",
          path: relativePath,
          message: "Sharded sites must use a sharded data plane.",
        })
      }
    }
  }
}

export function createConfigSurfaceReport() {
  issues.length = 0
  warnings.length = 0

  const config = readJson(".ai/config-surface.json")
  validateConfigSurface(config)
  const { envReads, dynamicEnvReads } = validateEnvReads(config)
  validateEnvExamples(config)
  validateProfiles()

  return {
    ok: issues.length === 0,
    generatedAt: new Date().toISOString(),
    registeredConfigCount: Object.keys(config?.entries || {}).length,
    scannedEnvReadCount: envReads.size,
    dynamicEnvReadCount: dynamicEnvReads.length,
    issues,
    warnings,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = createConfigSurfaceReport()

  console.log(JSON.stringify(report, null, 2))

  if (!report.ok) {
    process.exit(1)
  }
}
