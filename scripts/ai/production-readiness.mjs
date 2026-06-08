import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const CONFIG_PATH = ".ai/production-readiness.json"
const CONFIG_SURFACE_PATH = ".ai/config-surface.json"
const ROUTE_ROOT = "apps/backend/src/api"
const MODULE_ROOT = "apps/backend/src/modules"
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
const today = new Date().toISOString().slice(0, 10)

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"))
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`)
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function normalizePath(value) {
  return value.split(path.sep).join("/")
}

function listFiles(relativeDir, predicate = () => true) {
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

function listDirectories(relativeDir) {
  const absoluteDir = path.join(root, relativeDir)

  if (!fs.existsSync(absoluteDir)) {
    return []
  }

  return fs.readdirSync(absoluteDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => normalizePath(path.join(relativeDir, entry.name)))
    .sort()
}

function parseSourceFile(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8")
  return {
    source,
    file: ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
  }
}

function hasExportModifier(node) {
  return Boolean(
    node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  )
}

function nodeText(sourceFile, node) {
  return node.getText(sourceFile)
}

function routeFromFile(relativePath) {
  const route = relativePath
    .replace(`${ROUTE_ROOT}/`, "")
    .replace(/\/route\.ts$/, "")
    .replace(/(^|\/)\[([^\]]+)\]/g, "$1:$2")

  return `/${route}`.replace(/\/+/g, "/")
}

function surfaceFromRoute(route) {
  if (route.startsWith("/admin/")) return "admin"
  if (route.startsWith("/store/")) return "store"
  if (route.startsWith("/hooks/")) return "webhook"
  if (route === "/health") return "health"
  return "backend-api"
}

function ownerFromRoute(route) {
  if (route.startsWith("/admin/analytics/")) return "analytics-core"
  if (route.startsWith("/admin/content/") || route.startsWith("/store/content/")) return "content-core"
  if (route.startsWith("/admin/marketing/") || route.startsWith("/store/marketing/")) return "marketing-engine"
  if (route.startsWith("/admin/credential-inventory/")) return "credential-inventory"
  if (route.startsWith("/admin/digital-delivery/") || route.startsWith("/store/deliveries/")) return "digital-delivery"
  if (route.startsWith("/admin/payment-") || route.startsWith("/store/payment-") || route.startsWith("/store/carts/") || route.startsWith("/hooks/payment/")) return "payment-router"
  if (route.startsWith("/admin/suppliers/")) return "supplier-procurement"
  if (route.startsWith("/admin/after-sales") || route.startsWith("/admin/audit-logs") || route.includes("/after-sales")) return "support-audit"
  if (route.startsWith("/store/order-access/") || route.startsWith("/store/orders/recover")) return "guest-order-access"
  if (route === "/health") return "runtime-health"
  if (route.startsWith("/store/")) return "store-api"
  if (route.startsWith("/admin/")) return "admin-api"
  return "backend-api"
}

function analyzeFunctionBody(sourceFile, method, params, body) {
  const requestNames = new Set()
  const firstParam = params[0]

  if (firstParam?.name && ts.isIdentifier(firstParam.name)) {
    requestNames.add(firstParam.name.text)
  }
  requestNames.add("req")
  requestNames.add("request")

  const fact = {
    method,
    bodyRead: false,
    validatedBodyRead: false,
  }

  function visit(node) {
    if (ts.isPropertyAccessExpression(node)) {
      const property = node.name.text
      const expression = node.expression

      if (ts.isIdentifier(expression) && requestNames.has(expression.text)) {
        if (property === "body") {
          fact.bodyRead = true
        }
        if (property === "validatedBody") {
          fact.validatedBodyRead = true
        }
      }
    }

    if (ts.isElementAccessExpression(node)) {
      const expression = node.expression
      const argument = node.argumentExpression

      if (
        ts.isIdentifier(expression) &&
        requestNames.has(expression.text) &&
        ts.isStringLiteral(argument)
      ) {
        if (argument.text === "body") {
          fact.bodyRead = true
        }
        if (argument.text === "validatedBody") {
          fact.validatedBodyRead = true
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  if (body) {
    visit(body)
  } else {
    const text = nodeText(sourceFile, sourceFile)

    if (new RegExp(`\\b${method}\\b[\\s\\S]*?\\.body\\b`).test(text)) {
      fact.bodyRead = true
    }
  }

  return fact
}

function collectRouteFacts() {
  return listFiles(ROUTE_ROOT, (file) => file.endsWith("/route.ts"))
    .sort()
    .map((relativePath) => {
      const { file } = parseSourceFile(relativePath)
      const methods = []
      const methodFacts = new Map()

      function addMethod(method, fact = null) {
        if (!HTTP_METHODS.has(method)) {
          return
        }
        if (!methods.includes(method)) {
          methods.push(method)
        }
        if (fact) {
          methodFacts.set(method, fact)
        }
      }

      function visit(node) {
        if (ts.isFunctionDeclaration(node) && hasExportModifier(node) && node.name) {
          const method = node.name.text
          addMethod(method, analyzeFunctionBody(file, method, node.parameters, node.body))
        }

        if (ts.isVariableStatement(node) && hasExportModifier(node)) {
          for (const declaration of node.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name)) {
              continue
            }

            const method = declaration.name.text
            const initializer = declaration.initializer

            if (
              initializer &&
              (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
            ) {
              addMethod(
                method,
                analyzeFunctionBody(file, method, initializer.parameters, initializer.body)
              )
            } else {
              addMethod(method)
            }
          }
        }

        ts.forEachChild(node, visit)
      }

      visit(file)

      const route = routeFromFile(relativePath)
      const sortedMethods = methods.sort()

      return {
        path: relativePath,
        route,
        surface: surfaceFromRoute(route),
        owner: ownerFromRoute(route),
        methods: sortedMethods,
        methodFacts: sortedMethods.map((method) => ({
          method,
          bodyRead: methodFacts.get(method)?.bodyRead === true,
          validatedBodyRead: methodFacts.get(method)?.validatedBodyRead === true,
        })),
      }
    })
}

function fileReadsRequestBody(relativePath) {
  const { file } = parseSourceFile(relativePath)
  const requestNames = new Set(["req", "request"])
  const fact = {
    path: relativePath,
    bodyRead: false,
    validatedBodyRead: false,
  }

  function visit(node) {
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      const text = nodeText(file, node.type || node)

      if (/MedusaRequest|Request/.test(text)) {
        requestNames.add(node.name.text)
      }
    }

    if (ts.isPropertyAccessExpression(node)) {
      const expression = node.expression

      if (ts.isIdentifier(expression) && requestNames.has(expression.text)) {
        if (node.name.text === "body") {
          fact.bodyRead = true
        }
        if (node.name.text === "validatedBody") {
          fact.validatedBodyRead = true
        }
      }
    }

    if (ts.isElementAccessExpression(node)) {
      const expression = node.expression
      const argument = node.argumentExpression

      if (
        ts.isIdentifier(expression) &&
        requestNames.has(expression.text) &&
        ts.isStringLiteral(argument)
      ) {
        if (argument.text === "body") {
          fact.bodyRead = true
        }
        if (argument.text === "validatedBody") {
          fact.validatedBodyRead = true
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(file)
  return fact
}

function collectApiBodyReadHelpers() {
  return listFiles(ROUTE_ROOT, (file) =>
    file.endsWith(".ts") &&
    !file.endsWith("/route.ts") &&
    !file.endsWith("/middlewares.ts") &&
    !file.includes("/__tests__/")
  )
    .map(fileReadsRequestBody)
    .filter((fact) => fact.bodyRead || fact.validatedBodyRead)
    .sort((left, right) => left.path.localeCompare(right.path))
}

function propertyName(prop) {
  if (!ts.isPropertyAssignment(prop)) {
    return null
  }

  if (ts.isIdentifier(prop.name)) {
    return prop.name.text
  }

  if (ts.isStringLiteral(prop.name)) {
    return prop.name.text
  }

  return null
}

function collectMiddlewareBodyValidation() {
  const middlewarePath = `${ROUTE_ROOT}/middlewares.ts`

  if (!exists(middlewarePath)) {
    return []
  }

  const { file } = parseSourceFile(middlewarePath)
  const validated = []

  function visit(node) {
    if (!ts.isObjectLiteralExpression(node)) {
      ts.forEachChild(node, visit)
      return
    }

    let matcher = null
    let methods = []

    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) {
        continue
      }

      const name = propertyName(prop)
      const initializer = prop.initializer

      if (name === "matcher" && ts.isStringLiteral(initializer)) {
        matcher = initializer.text
      }

      if (name === "methods" && ts.isArrayLiteralExpression(initializer)) {
        methods = initializer.elements
          .filter(ts.isStringLiteral)
          .map((element) => element.text)
          .filter((method) => HTTP_METHODS.has(method))
      }
    }

    if (matcher && methods.length && nodeText(file, node).includes("validateAndTransformBody(")) {
      for (const method of methods) {
        validated.push({ matcher, method })
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(file)
  return validated.sort((left, right) =>
    `${left.matcher}#${left.method}`.localeCompare(`${right.matcher}#${right.method}`)
  )
}

function collectModelTables(modelFiles) {
  const tables = []

  for (const relativePath of modelFiles) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8")
    const matches = source.matchAll(/model\.define\(\s*["']([^"']+)["']/g)

    for (const match of matches) {
      tables.push(match[1])
    }
  }

  return [...new Set(tables)].sort()
}

function fingerprintFiles(files) {
  const hash = crypto.createHash("sha256")

  for (const file of files.sort()) {
    hash.update(`\n--- ${file} ---\n`)
    hash.update(fs.readFileSync(path.join(root, file), "utf8"))
  }

  return `sha256:${hash.digest("hex")}`
}

function collectMigrationFacts() {
  return listDirectories(MODULE_ROOT)
    .map((modulePath) => {
      const moduleName = path.basename(modulePath)
      const modelFiles = listFiles(`${modulePath}/models`, (file) => file.endsWith(".ts")).sort()
      const migrationFiles = listFiles(`${modulePath}/migrations`, (file) =>
        /\/Migration\d+\.ts$/.test(file)
      ).sort()
      const snapshotFiles = listFiles(`${modulePath}/migrations`, (file) =>
        /\/\.snapshot-.+\.json$/.test(file)
      ).sort()
      const modelTables = collectModelTables(modelFiles)

      return {
        module: moduleName,
        owner: moduleName,
        path: modulePath,
        modelFiles,
        modelTables,
        migrationFiles,
        snapshotFiles,
        schemaFingerprint: modelFiles.length ? fingerprintFiles(modelFiles) : null,
      }
    })
    .filter((entry) => entry.modelFiles.length > 0)
    .sort((left, right) => left.module.localeCompare(right.module))
}

function parseEnvFile(relativePath) {
  const values = new Map()
  const absolutePath = path.join(root, relativePath)

  if (!fs.existsSync(absolutePath)) {
    return values
  }

  const source = fs.readFileSync(absolutePath, "utf8")

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const separator = trimmed.indexOf("=")

    if (separator === -1) {
      continue
    }

    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "")

    values.set(key, value)
  }

  return values
}

function requiredProductionKeysByScope() {
  const configSurface = readJson(CONFIG_SURFACE_PATH)
  const byScope = new Map()

  for (const [key, entry] of Object.entries(configSurface.entries || {})) {
    if (entry?.requiredInProduction !== true) {
      continue
    }

    const scope = entry.scope || "shared"
    const keys = byScope.get(scope) || []
    keys.push({ key, visibility: entry.visibility || "internal", owner: entry.owner || "unknown" })
    byScope.set(scope, keys)
  }

  for (const keys of byScope.values()) {
    keys.sort((left, right) => left.key.localeCompare(right.key))
  }

  return byScope
}

function keysForScopes(byScope, scopes) {
  return scopes.flatMap((scope) => byScope.get(scope) || [])
    .filter((entry, index, entries) =>
      entries.findIndex((candidate) => candidate.key === entry.key) === index
    )
    .sort((left, right) => left.key.localeCompare(right.key))
}

function isPlaceholderValue(value, patterns) {
  if (!value || !value.trim()) {
    return true
  }

  return patterns.some((pattern) => new RegExp(pattern, "i").test(value))
}

function readJsonFromGit(ref, relativePath) {
  if (!ref) {
    return null
  }

  const result = spawnSync("git", ["show", `${ref}:${relativePath}`], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  })

  if (result.status !== 0 || !result.stdout.trim()) {
    return null
  }

  try {
    return JSON.parse(result.stdout)
  } catch {
    return null
  }
}

function sameStringArray(left, right) {
  return JSON.stringify([...(left || [])].sort()) === JSON.stringify([...(right || [])].sort())
}

function acceptedDebtKey(pathValue, method) {
  return `${pathValue}#${method}`
}

function collectAcceptedDebtKeys(config) {
  const keys = new Set()

  for (const route of config?.routeContract?.routes || []) {
    for (const [method, validation] of Object.entries(route.bodyValidation || {})) {
      if (validation?.kind === "accepted-debt") {
        keys.add(acceptedDebtKey(route.path, method))
      }
    }
  }

  return keys
}

function validateMetadata(entry, context, issues) {
  if (!entry?.owner) {
    issues.push({
      id: `${context}.owner-missing`,
      message: "Entry must declare owner.",
    })
  }

  if (!Array.isArray(entry?.verification) || entry.verification.length === 0) {
    issues.push({
      id: `${context}.verification-missing`,
      message: "Entry must declare verification commands.",
    })
  }
}

function validateAcceptedDebt(validation, route, method, issues, warnings) {
  for (const field of ["owner", "rationale", "target", "expiresAt"]) {
    if (!validation?.[field]) {
      issues.push({
        id: "production.route-body-debt-metadata-missing",
        path: route.path,
        method,
        field,
        message: "Accepted body-validation debt must declare owner, rationale, target, and expiresAt.",
      })
    }
  }

  if (!Array.isArray(validation?.verification) || validation.verification.length === 0) {
    issues.push({
      id: "production.route-body-debt-verification-missing",
      path: route.path,
      method,
      message: "Accepted body-validation debt must declare verification commands.",
    })
  }

  if (validation?.expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(validation.expiresAt)) {
    issues.push({
      id: "production.route-body-debt-expiry-invalid",
      path: route.path,
      method,
      expiresAt: validation.expiresAt,
      message: "Accepted body-validation debt expiresAt must be YYYY-MM-DD.",
    })
  } else if (validation?.expiresAt && validation.expiresAt < today) {
    issues.push({
      id: "production.route-body-debt-expired",
      path: route.path,
      method,
      expiresAt: validation.expiresAt,
      message: "Accepted body-validation debt expired. Add validateAndTransformBody coverage or renew the rationale.",
    })
  } else {
    warnings.push({
      id: "production.route-body-validation-debt-accepted",
      path: route.path,
      method,
      owner: validation?.owner,
      expiresAt: validation?.expiresAt,
      message: "Route reads request body without middleware schema validation, but the gap is explicitly baselined with owner and expiry.",
    })
  }
}

function validateRouteContract(config, issues, warnings) {
  const routes = collectRouteFacts()
  const bodyReadHelpers = collectApiBodyReadHelpers()
  const middlewareValidation = collectMiddlewareBodyValidation()
  const middlewareValidationSet = new Set(
    middlewareValidation.map((entry) => `${entry.matcher}#${entry.method}`)
  )
  const configRoutes = config?.routeContract?.routes || []
  const configByPath = new Map(configRoutes.map((route) => [route.path, route]))
  const currentPathSet = new Set(routes.map((route) => route.path))
  const bodyReadingMethods = []
  const middlewareValidatedMethods = []
  const acceptedDebtMethods = []
  const helperByPath = new Map(
    (config?.routeContract?.bodyReadHelpers || []).map((entry) => [entry.path, entry])
  )
  const currentHelperPathSet = new Set(bodyReadHelpers.map((entry) => entry.path))

  for (const route of routes) {
    const entry = configByPath.get(route.path)

    if (!entry) {
      issues.push({
        id: "production.api-contract-route-untracked",
        path: route.path,
        route: route.route,
        message: "API route exists without .ai/production-readiness.json route contract entry.",
      })
      continue
    }

    validateMetadata(entry, "production.api-contract-route", issues)

    if (entry.route !== route.route) {
      issues.push({
        id: "production.api-contract-route-mismatch",
        path: route.path,
        expected: route.route,
        actual: entry.route,
        message: "API route contract path does not match filesystem route.",
      })
    }

    if (!sameStringArray(entry.methods, route.methods)) {
      issues.push({
        id: "production.api-contract-methods-changed",
        path: route.path,
        expected: route.methods,
        actual: entry.methods,
        message: "API route methods changed without updating the public contract snapshot.",
      })
    }

    for (const fact of route.methodFacts) {
      const key = `${route.route}#${fact.method}`
      const middlewareValidated = middlewareValidationSet.has(key)
      const validation = entry.bodyValidation?.[fact.method]

      if (fact.bodyRead || fact.validatedBodyRead) {
        bodyReadingMethods.push({ path: route.path, method: fact.method })
      }

      if (fact.bodyRead && middlewareValidated) {
        middlewareValidatedMethods.push({ path: route.path, method: fact.method })

        if (validation?.kind !== "middleware") {
          issues.push({
            id: "production.route-body-validation-contract-missing",
            path: route.path,
            method: fact.method,
            message: "Route body is middleware-validated but contract does not record middleware validation.",
          })
        }
      }

      if (fact.bodyRead && !middlewareValidated) {
        if (!validation) {
          issues.push({
            id: "production.route-body-validation-missing",
            path: route.path,
            method: fact.method,
            message: "Route reads req.body without validateAndTransformBody coverage or accepted debt metadata.",
          })
          continue
        }

        if (validation.kind === "accepted-debt") {
          acceptedDebtMethods.push({ path: route.path, method: fact.method })
          validateAcceptedDebt(validation, route, fact.method, issues, warnings)
        } else if (validation.kind === "manual") {
          validateMetadata(validation, "production.route-body-manual-validation", issues)
          if (!validation.rationale) {
            issues.push({
              id: "production.route-body-manual-rationale-missing",
              path: route.path,
              method: fact.method,
              message: "Manual body validation must declare rationale.",
            })
          }
        } else {
          issues.push({
            id: "production.route-body-validation-kind-invalid",
            path: route.path,
            method: fact.method,
            kind: validation.kind,
            message: "Body validation kind must be middleware, manual, or accepted-debt.",
          })
        }
      }
    }

    for (const method of Object.keys(entry.bodyValidation || {})) {
      if (!route.methods.includes(method)) {
        warnings.push({
          id: "production.route-body-validation-contract-stale",
          path: route.path,
          method,
          message: "Route body-validation contract references a method no longer exported by the route.",
        })
      }
    }
  }

  for (const route of configRoutes) {
    if (!currentPathSet.has(route.path)) {
      warnings.push({
        id: "production.api-contract-route-stale",
        path: route.path,
        message: "API route contract entry no longer maps to a route file.",
      })
    }
  }

  for (const helper of bodyReadHelpers) {
    const entry = helperByPath.get(helper.path)

    if (!entry) {
      issues.push({
        id: "production.api-body-helper-untracked",
        path: helper.path,
        message:
          "API helper reads request body outside a route file. Register its caller validation path in .ai/production-readiness.json.",
      })
      continue
    }

    validateMetadata(entry, "production.api-body-helper", issues)

    if (!Array.isArray(entry.callers) || entry.callers.length === 0) {
      issues.push({
        id: "production.api-body-helper-callers-missing",
        path: helper.path,
        message: "API body-reading helper must declare route callers and validation evidence.",
      })
    }

    for (const caller of entry.callers || []) {
      const callerKey = `${caller.matcher}#${caller.method}`

      if (!middlewareValidationSet.has(callerKey)) {
        issues.push({
          id: "production.api-body-helper-caller-validation-missing",
          path: helper.path,
          caller,
          message:
            "API helper reads request body, but the declared caller does not have validateAndTransformBody middleware coverage.",
        })
      }
    }
  }

  for (const entry of config?.routeContract?.bodyReadHelpers || []) {
    if (!currentHelperPathSet.has(entry.path)) {
      warnings.push({
        id: "production.api-body-helper-stale",
        path: entry.path,
        message: "API body-reading helper baseline no longer maps to a current helper body read.",
      })
    }
  }

  return {
    routeCount: routes.length,
    methodCount: routes.reduce((count, route) => count + route.methods.length, 0),
    bodyReadingMethodCount: bodyReadingMethods.length,
    middlewareValidatedBodyMethodCount: middlewareValidatedMethods.length,
    acceptedDebtBodyMethodCount: acceptedDebtMethods.length,
    middlewareBodyValidationCount: middlewareValidation.length,
    bodyReadHelperCount: bodyReadHelpers.length,
    routes: routes.map((route) => ({
      path: route.path,
      route: route.route,
      surface: route.surface,
      methods: route.methods,
      methodFacts: route.methodFacts,
    })),
    bodyReadHelpers,
  }
}

function validateMigrationFile(relativePath, issues) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8")
  const className = path.basename(relativePath, ".ts")

  if (!source.includes(`class ${className}`)) {
    issues.push({
      id: "production.migration-class-name-mismatch",
      path: relativePath,
      className,
      message: "Migration class name must match the migration filename.",
    })
  }

  if (!/\bup\s*\(/.test(source)) {
    issues.push({
      id: "production.migration-up-missing",
      path: relativePath,
      message: "Migration must define an up() method.",
    })
  }

  if (!/\bdown\s*\(/.test(source)) {
    issues.push({
      id: "production.migration-down-missing",
      path: relativePath,
      message: "Migration must define a down() method.",
    })
  }
}

function validateMigrations(config, baseConfig, issues, warnings) {
  const currentModules = collectMigrationFacts()
  const configModules = config?.migrations?.modules || []
  const configByModule = new Map(configModules.map((entry) => [entry.module, entry]))
  const currentModuleSet = new Set(currentModules.map((entry) => entry.module))
  const timestamps = new Map()

  for (const moduleEntry of currentModules) {
    const configEntry = configByModule.get(moduleEntry.module)

    if (!configEntry) {
      issues.push({
        id: "production.schema-module-untracked",
        module: moduleEntry.module,
        path: moduleEntry.path,
        message: "Module has Medusa models without a production schema baseline entry.",
      })
      continue
    }

    validateMetadata(configEntry, "production.schema-module", issues)

    if (!sameStringArray(configEntry.modelTables, moduleEntry.modelTables)) {
      issues.push({
        id: "production.schema-tables-changed",
        module: moduleEntry.module,
        expected: moduleEntry.modelTables,
        actual: configEntry.modelTables,
        message: "Model table set changed without updating the schema baseline.",
      })
    }

    if (!sameStringArray(configEntry.modelFiles, moduleEntry.modelFiles)) {
      issues.push({
        id: "production.schema-model-files-changed",
        module: moduleEntry.module,
        expected: moduleEntry.modelFiles,
        actual: configEntry.modelFiles,
        message: "Model files changed without updating the schema baseline.",
      })
    }

    if (!sameStringArray(configEntry.migrationFiles, moduleEntry.migrationFiles)) {
      issues.push({
        id: "production.schema-migration-files-changed",
        module: moduleEntry.module,
        expected: moduleEntry.migrationFiles,
        actual: configEntry.migrationFiles,
        message: "Migration files changed without updating the schema baseline.",
      })
    }

    if (!sameStringArray(configEntry.snapshotFiles, moduleEntry.snapshotFiles)) {
      issues.push({
        id: "production.schema-snapshot-files-changed",
        module: moduleEntry.module,
        expected: moduleEntry.snapshotFiles,
        actual: configEntry.snapshotFiles,
        message: "Schema snapshot files changed without updating the schema baseline.",
      })
    }

    if (configEntry.schemaFingerprint !== moduleEntry.schemaFingerprint) {
      issues.push({
        id: "production.schema-fingerprint-changed",
        module: moduleEntry.module,
        message: "Model fingerprint changed without updating the schema baseline.",
      })
    }

    if (moduleEntry.migrationFiles.length === 0) {
      issues.push({
        id: "production.schema-migration-missing",
        module: moduleEntry.module,
        message: "Module has models but no migration files.",
      })
    }

    if (moduleEntry.snapshotFiles.length === 0) {
      issues.push({
        id: "production.schema-snapshot-missing",
        module: moduleEntry.module,
        message: "Module has models but no schema snapshot files.",
      })
    }

    for (const migrationFile of moduleEntry.migrationFiles) {
      validateMigrationFile(migrationFile, issues)
      const timestamp = path.basename(migrationFile).match(/Migration(\d+)\.ts$/)?.[1]

      if (!timestamp) {
        continue
      }

      if (timestamps.has(timestamp)) {
        issues.push({
          id: "production.migration-timestamp-duplicate",
          path: migrationFile,
          duplicateOf: timestamps.get(timestamp),
          message: "Migration timestamps must be globally unique.",
        })
      }
      timestamps.set(timestamp, migrationFile)
    }
  }

  for (const configEntry of configModules) {
    if (!currentModuleSet.has(configEntry.module)) {
      warnings.push({
        id: "production.schema-module-stale",
        module: configEntry.module,
        message: "Schema baseline references a module with no current model files.",
      })
    }
  }

  if (baseConfig) {
    const baseByModule = new Map(
      (baseConfig.migrations?.modules || []).map((entry) => [entry.module, entry])
    )

    for (const configEntry of configModules) {
      const baseEntry = baseByModule.get(configEntry.module)

      if (!baseEntry) {
        continue
      }

      if (configEntry.schemaFingerprint !== baseEntry.schemaFingerprint) {
        const addedMigrations = (configEntry.migrationFiles || []).filter(
          (file) => !(baseEntry.migrationFiles || []).includes(file)
        )

        if (addedMigrations.length === 0) {
          issues.push({
            id: "production.schema-baseline-changed-without-new-migration",
            module: configEntry.module,
            message:
              "PR changed a model schema fingerprint without adding a migration file. Add a migration before updating the production schema baseline.",
          })
        }
      }
    }
  }

  return {
    modelModuleCount: currentModules.length,
    migrationFileCount: currentModules.reduce(
      (count, entry) => count + entry.migrationFiles.length,
      0
    ),
    snapshotFileCount: currentModules.reduce(
      (count, entry) => count + entry.snapshotFiles.length,
      0
    ),
    modules: currentModules,
  }
}

function validateProductionConfig(config, issues, warnings) {
  const byScope = requiredProductionKeysByScope()
  const exampleFiles = config?.productionConfig?.exampleFiles || []
  const actualFiles = config?.productionConfig?.actualEnvFiles || []
  const placeholderPatterns = config?.productionConfig?.placeholderPatterns || []
  const checkedExamples = []
  const checkedActualFiles = []

  for (const example of exampleFiles) {
    validateMetadata(example, "production.config-example", issues)

    if (!exists(example.path)) {
      issues.push({
        id: "production.config-example-missing",
        path: example.path,
        message: "Production config example file does not exist.",
      })
      continue
    }

    const env = parseEnvFile(example.path)
    const requiredKeys = [
      ...keysForScopes(byScope, example.scopes || []),
      ...(example.extraRequiredKeys || []).map((key) => ({
        key,
        visibility: "secret",
        owner: example.owner || "ops-runtime",
      })),
    ]
    const missing = []
    const empty = []

    for (const entry of requiredKeys) {
      if (!env.has(entry.key)) {
        missing.push(entry.key)
      } else if (!env.get(entry.key)?.trim()) {
        empty.push(entry.key)
      }
    }

    if (missing.length) {
      issues.push({
        id: "production.config-example-key-missing",
        path: example.path,
        keys: missing,
        message: "Production config example is missing required production keys.",
      })
    }

    if (empty.length) {
      issues.push({
        id: "production.config-example-required-key-empty",
        path: example.path,
        keys: empty,
        message: "Production config example leaves required production keys empty.",
      })
    }

    checkedExamples.push({
      path: example.path,
      scopes: example.scopes || [],
      requiredKeyCount: requiredKeys.length,
      missingKeyCount: missing.length,
      emptyKeyCount: empty.length,
    })
  }

  for (const actual of actualFiles) {
    validateMetadata(actual, "production.config-actual-env", issues)

    const envFile = process.env[actual.envVar]

    if (!envFile) {
      checkedActualFiles.push({
        envVar: actual.envVar,
        checked: false,
        reason: "env-var-not-set",
      })
      continue
    }

    const relativePath = path.isAbsolute(envFile)
      ? path.relative(root, envFile)
      : envFile

    if (!exists(relativePath)) {
      issues.push({
        id: "production.config-actual-env-file-missing",
        envVar: actual.envVar,
        path: relativePath,
        message: "Configured production env file does not exist.",
      })
      continue
    }

    const env = parseEnvFile(relativePath)
    const requiredKeys = [
      ...keysForScopes(byScope, actual.scopes || []),
      ...(actual.extraRequiredKeys || []).map((key) => ({
        key,
        visibility: "secret",
        owner: actual.owner || "ops-runtime",
      })),
    ]
    const missing = []
    const placeholder = []

    for (const entry of requiredKeys) {
      const value = env.get(entry.key)

      if (value === undefined) {
        missing.push(entry.key)
      } else if (isPlaceholderValue(value, placeholderPatterns)) {
        placeholder.push(entry.key)
      }
    }

    if (missing.length) {
      issues.push({
        id: "production.config-actual-env-key-missing",
        envVar: actual.envVar,
        path: relativePath,
        keys: missing,
        message: "Actual production env file is missing required production keys.",
      })
    }

    if (placeholder.length) {
      issues.push({
        id: "production.config-actual-env-placeholder",
        envVar: actual.envVar,
        path: relativePath,
        keys: placeholder,
        message: "Actual production env file contains empty, example, localhost, or replace-with placeholder values.",
      })
    }

    checkedActualFiles.push({
      envVar: actual.envVar,
      path: relativePath,
      checked: true,
      requiredKeyCount: requiredKeys.length,
      missingKeyCount: missing.length,
      placeholderKeyCount: placeholder.length,
    })
  }

  if (checkedActualFiles.every((entry) => entry.checked === false)) {
    warnings.push({
      id: "production.config-actual-env-not-checked",
      message:
        "Actual production env files were not provided. CI can verify templates, but go-live must rerun pnpm ai:production with actual env file variables set.",
    })
  }

  return {
    requiredProductionKeyCount: [...byScope.values()].flat().length,
    exampleFiles: checkedExamples,
    actualEnvFiles: checkedActualFiles,
  }
}

function createBaselineConfig() {
  const routes = collectRouteFacts()
  const middlewareValidation = collectMiddlewareBodyValidation()
  const middlewareValidationSet = new Set(
    middlewareValidation.map((entry) => `${entry.matcher}#${entry.method}`)
  )
  const migrationModules = collectMigrationFacts()

  return {
    version: "1.0.0",
    createdAt: today,
    principles: [
      "Public API contract changes must be visible in machine-readable route entries.",
      "Routes that read request bodies must use validateAndTransformBody or carry expiring accepted debt.",
      "Model schema changes must carry migration and snapshot evidence.",
      "Production-required config must be present in templates; real go-live env files must not use placeholders."
    ],
    routeContract: {
      sourceRoot: ROUTE_ROOT,
      bodyReadHelpers: collectApiBodyReadHelpers().map((helper) => ({
        path: helper.path,
        owner: helper.path.includes("/payment/") ? "payment-router" : "backend-api",
        callers: middlewareValidation
          .filter((entry) =>
            helper.path.includes("/payment/") && entry.matcher.startsWith("/hooks/payment/")
          )
          .map((entry) => ({
            matcher: entry.matcher,
            method: entry.method,
            validation: "validateAndTransformBody",
          })),
        rationale:
          "Helper reads request body for a route whose middleware preserves raw body and applies validateAndTransformBody before handler logic.",
        verification: ["pnpm ai:production", "pnpm check:ci"],
      })),
      routes: routes.map((route) => {
        const bodyValidation = {}

        for (const fact of route.methodFacts) {
          if (!fact.bodyRead && !fact.validatedBodyRead) {
            continue
          }

          const validation = middlewareValidation.find(
            (entry) => entry.matcher === route.route && entry.method === fact.method
          )

          if (validation || middlewareValidationSet.has(`${route.route}#${fact.method}`)) {
            bodyValidation[fact.method] = {
              kind: "middleware",
              matcher: route.route,
              owner: route.owner,
              verification: ["pnpm ai:production", "pnpm check:ci"],
            }
          } else if (fact.bodyRead) {
            bodyValidation[fact.method] = {
              kind: "accepted-debt",
              owner: route.owner,
              rationale:
                "Existing route reads req.body without validateAndTransformBody middleware. This is frozen so future body-reading endpoints must add schema validation instead of copying this pattern.",
              target: "Move body validation into apps/backend/src/api/middlewares.ts with a Zod schema and validateAndTransformBody.",
              expiresAt: "2026-08-07",
              verification: ["pnpm ai:production", "pnpm check:ci"],
            }
          }
        }

        return {
          path: route.path,
          route: route.route,
          surface: route.surface,
          owner: route.owner,
          methods: route.methods,
          verification: ["pnpm ai:production", "pnpm check:ci"],
          ...(Object.keys(bodyValidation).length ? { bodyValidation } : {}),
        }
      }),
    },
    migrations: {
      moduleRoot: MODULE_ROOT,
      requireSnapshotForModelModules: true,
      modules: migrationModules.map((entry) => ({
        module: entry.module,
        path: entry.path,
        owner: entry.owner,
        modelFiles: entry.modelFiles,
        modelTables: entry.modelTables,
        migrationFiles: entry.migrationFiles,
        snapshotFiles: entry.snapshotFiles,
        schemaFingerprint: entry.schemaFingerprint,
        verification: ["pnpm ai:production", "pnpm --dir apps/backend test:unit"],
      })),
    },
    productionConfig: {
      configSurface: CONFIG_SURFACE_PATH,
      placeholderPatterns: [
        "replace-with",
        "example\\.com",
        "localhost",
        "127\\.0\\.0\\.1",
        "pk_your",
        "your_",
        "^$"
      ],
      exampleFiles: [
        {
          path: "ops/env/backend.production.env.example",
          scopes: ["backend", "shared"],
          owner: "config-surface",
          verification: ["pnpm ai:production", "pnpm ai:config"],
        },
        {
          path: "ops/env/storefront.production.env.example",
          scopes: ["storefront", "shared"],
          owner: "config-surface",
          verification: ["pnpm ai:production", "pnpm ai:config"],
        },
        {
          path: "ops/env/services.production.env.example",
          scopes: [],
          extraRequiredKeys: ["POSTGRES_PASSWORD", "REDIS_PASSWORD"],
          owner: "ops-runtime",
          verification: ["pnpm ai:production"],
        },
      ],
      actualEnvFiles: [
        {
          envVar: "AI_BACKEND_PRODUCTION_ENV_FILE",
          scopes: ["backend", "shared"],
          owner: "config-surface",
          verification: ["pnpm ai:production"],
        },
        {
          envVar: "AI_STOREFRONT_PRODUCTION_ENV_FILE",
          scopes: ["storefront", "shared"],
          owner: "config-surface",
          verification: ["pnpm ai:production"],
        },
        {
          envVar: "AI_SERVICES_PRODUCTION_ENV_FILE",
          scopes: [],
          extraRequiredKeys: ["POSTGRES_PASSWORD", "REDIS_PASSWORD"],
          owner: "ops-runtime",
          verification: ["pnpm ai:production"],
        },
      ],
    },
  }
}

export function createProductionReadinessReport() {
  const issues = []
  const warnings = []
  let config = null

  try {
    config = readJson(CONFIG_PATH)
  } catch (error) {
    issues.push({
      id: "production-readiness.config-invalid",
      path: CONFIG_PATH,
      message: error instanceof Error ? error.message : "Production readiness config is invalid.",
    })
  }

  if (!config) {
    return {
      ok: false,
      generatedAt: new Date().toISOString(),
      issueCount: issues.length,
      warningCount: warnings.length,
      issues,
      warnings,
    }
  }

  const compareRef = process.env.AI_BASELINE_COMPARE_REF?.trim()
  const baseConfig = readJsonFromGit(compareRef, CONFIG_PATH)
  const routeContract = validateRouteContract(config, issues, warnings)
  const migrations = validateMigrations(config, baseConfig, issues, warnings)
  const productionConfig = validateProductionConfig(config, issues, warnings)

  if (baseConfig) {
    const baseDebt = collectAcceptedDebtKeys(baseConfig)
    const currentDebt = collectAcceptedDebtKeys(config)
    const addedDebt = [...currentDebt].filter((key) => !baseDebt.has(key))

    if (addedDebt.length) {
      issues.push({
        id: "production.route-body-debt-added-in-pr",
        addedDebt,
        message:
          "PR added accepted body-validation debt. Add middleware schema validation instead of expanding the debt baseline.",
      })
    }
  }

  return {
    ok: issues.length === 0,
    generatedAt: new Date().toISOString(),
    issueCount: issues.length,
    warningCount: warnings.length,
    summary: {
      apiRoutes: routeContract.routeCount,
      apiMethods: routeContract.methodCount,
      bodyReadingMethods: routeContract.bodyReadingMethodCount,
      middlewareValidatedBodyMethods: routeContract.middlewareValidatedBodyMethodCount,
      acceptedDebtBodyMethods: routeContract.acceptedDebtBodyMethodCount,
      apiBodyReadHelpers: routeContract.bodyReadHelperCount,
      modelModules: migrations.modelModuleCount,
      migrationFiles: migrations.migrationFileCount,
      schemaSnapshotFiles: migrations.snapshotFileCount,
      requiredProductionConfigKeys: productionConfig.requiredProductionKeyCount,
    },
    routeContract,
    migrations,
    productionConfig,
    issues,
    warnings,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Set(process.argv.slice(2))

  if (args.has("--write-baseline")) {
    writeJson(CONFIG_PATH, createBaselineConfig())
  }

  const report = createProductionReadinessReport()

  console.log(JSON.stringify(report, null, 2))

  if (!report.ok) {
    process.exit(1)
  }
}
