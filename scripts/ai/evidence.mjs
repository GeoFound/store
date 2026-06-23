import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { createArchitectureReport } from "./architecture.mjs"
import { createBackendDecouplingReadinessReport } from "./backend-decoupling-readiness.mjs"
import { createConfigSurfaceReport } from "./config-surface.mjs"
import { createDoctorReport } from "./doctor.mjs"
import { createInventoryReport } from "./inventory.mjs"
import { createObligationsReport } from "./obligations.mjs"
import { createProductionReadinessReport } from "./production-readiness.mjs"
import { createStatusReport } from "./status.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const args = new Set(process.argv.slice(2))
const runFull = args.has("--full")
const writeReport = args.has("--write")

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"))
}

async function runCheck(check) {
  const inProcessResult = await runInProcessCheck(check)

  if (inProcessResult) {
    return inProcessResult
  }

  const [command, ...commandArgs] = check.command
  const startedAt = new Date().toISOString()
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    shell: false,
  })
  const finishedAt = new Date().toISOString()
  const stdout = result.stdout.trim()
  const stderr = result.stderr.trim()

  return {
    id: check.id,
    command: check.command,
    required: check.required === true,
    ok: result.status === 0,
    status: result.status,
    signal: result.signal || null,
    startedAt,
    finishedAt,
    stdout: check.allowOutput || result.status !== 0 ? stdout : summarize(stdout),
    stderr: stderr ? summarize(stderr) : "",
  }
}

async function runInProcessCheck(check) {
  const commandKey = check.command.join(" ")
  const startedAt = new Date().toISOString()
  let report = null

  try {
    if (commandKey === "pnpm ai:doctor") {
      report = await createDoctorReport()
    } else if (commandKey === "pnpm ai:backend-decoupling") {
      report = createBackendDecouplingReadinessReport()
    } else if (commandKey === "pnpm ai:architecture") {
      report = await createArchitectureReport()
    } else if (commandKey === "pnpm ai:config") {
      report = createConfigSurfaceReport()
    } else if (commandKey === "pnpm ai:inventory") {
      report = createInventoryReport()
    } else if (commandKey === "pnpm ai:obligations") {
      report = createObligationsReport()
    } else if (commandKey === "pnpm ai:production") {
      report = createProductionReadinessReport()
    } else if (commandKey === "pnpm ai:status") {
      report = await createStatusReport({ writeReport: true })
    } else {
      return null
    }
  } catch (error) {
    const finishedAt = new Date().toISOString()

    return {
      id: check.id,
      command: check.command,
      required: check.required === true,
      ok: false,
      status: 1,
      signal: null,
      startedAt,
      finishedAt,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      executionMode: "in-process",
    }
  }

  const finishedAt = new Date().toISOString()
  const stdout = JSON.stringify(report, null, 2)

  return {
    id: check.id,
    command: check.command,
    required: check.required === true,
    ok: report.ok === true,
    status: report.ok === true ? 0 : 1,
    signal: null,
    startedAt,
    finishedAt,
    stdout: check.allowOutput || report.ok !== true ? stdout : summarize(stdout),
    stderr: "",
    executionMode: "in-process",
  }
}

function summarize(value) {
  if (!value) {
    return ""
  }

  const lines = value.split("\n")
  if (lines.length <= 20) {
    return value
  }

  return [...lines.slice(0, 10), "...", ...lines.slice(-10)].join("\n")
}

const policy = readJson(".ai/evidence-policy.json")
const checks = [
  ...(policy.defaultChecks || []),
  ...(runFull ? policy.fullChecks || [] : []),
]
const results = []

for (const check of checks) {
  results.push(await runCheck(check))
}
const failedRequired = results.filter((result) => result.required && !result.ok)
const report = {
  ok: failedRequired.length === 0,
  mode: runFull ? "full" : "default",
  generatedAt: new Date().toISOString(),
  checks: results,
  skippedProductionChecks: policy.productionChecks || [],
  acceptanceRules: policy.acceptanceRules || [],
}

if (writeReport) {
  const reportDir = path.join(root, policy.reportDirectory || ".ai-trace/evidence")
  fs.mkdirSync(reportDir, { recursive: true })
  const reportPath = path.join(
    reportDir,
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${report.mode}.json`
  )
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  report.reportPath = path.relative(root, reportPath)
}

console.log(JSON.stringify(report, null, 2))

if (!report.ok) {
  process.exit(1)
}
