import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const args = new Set(process.argv.slice(2))
const runFull = args.has("--full")
const writeReport = args.has("--write")

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"))
}

function runCheck(check) {
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
const results = checks.map(runCheck)
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
