import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

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

const system = readJson(".ai/system.json")
const taskbook = readJson(".ai/taskbook.json")
const evidencePolicy = readJson(".ai/evidence-policy.json")
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

const report = {
  ok: issues.length === 0,
  generatedAt: new Date().toISOString(),
  issueCount: issues.length,
  warningCount: warnings.length,
  issues,
  warnings,
}

console.log(JSON.stringify(report, null, 2))

if (issues.length) {
  process.exit(1)
}
