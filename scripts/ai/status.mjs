import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { createDoctorReport } from "./doctor.mjs"
import { createInventoryReport } from "./inventory.mjs"
import { createProductionReadinessReport } from "./production-readiness.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"))
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
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

function listEvidenceReports() {
  const policy = readJson(".ai/evidence-policy.json")
  const reportDir = path.join(root, policy.reportDirectory || ".ai-trace/evidence")

  if (!fs.existsSync(reportDir)) {
    return []
  }

  return fs.readdirSync(reportDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const absolutePath = path.join(reportDir, name)
      const stat = fs.statSync(absolutePath)
      let ok = null
      let mode = null

      try {
        const report = JSON.parse(fs.readFileSync(absolutePath, "utf8"))
        ok = report.ok === true
        mode = report.mode || null
      } catch {
        ok = false
      }

      return {
        path: path.relative(root, absolutePath),
        modifiedAt: stat.mtime.toISOString(),
        ok,
        mode,
      }
    })
    .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))
}

export async function createStatusReport(options = {}) {
  const system = readJson(".ai/system.json")
  const systemMap = readJson(".ai/system-map.json")
  const taskbook = readJson(".ai/taskbook.json")
  const doctor = await createDoctorReport()
  const inventory = createInventoryReport()
  const production = createProductionReadinessReport()
  const gitStatus = run("git", ["status", "--short"])
  const evidenceReports = listEvidenceReports()
  const latestFullEvidence = evidenceReports.find((report) => report.mode === "full")
  const dirtyFiles = gitStatus.stdout.split("\n").filter(Boolean)
  const nextActions = []

  if (!doctor.ok) {
    nextActions.push("Run pnpm ai:doctor and fix reported machine-governance issues.")
  }

  if (!inventory.ok) {
    nextActions.push("Run pnpm ai:inventory and register or remove changed repository surface.")
  }

  if (!production.ok) {
    nextActions.push("Run pnpm ai:production and fix production readiness issues.")
  }

  if (!latestFullEvidence) {
    nextActions.push("Run pnpm ai:evidence:full to create a full evidence report.")
  } else if (latestFullEvidence.ok !== true) {
    nextActions.push(`Inspect failed full evidence report: ${latestFullEvidence.path}`)
  }

  if (dirtyFiles.length) {
    nextActions.push("Review current git worktree before starting unrelated work.")
  }

  const report = {
    ok: doctor.ok,
    generatedAt: new Date().toISOString(),
    repository: system.repository,
    product: system.product,
    systemMap: {
      nodeCount: systemMap.nodes?.length || 0,
      flowCount: systemMap.flows?.length || 0,
    },
    taskbook: {
      taskCount: taskbook.tasks?.length || 0,
      taskIds: taskbook.tasks?.map((task) => task.id) || [],
    },
    doctor: {
      ok: doctor.ok,
      status: doctor.ok ? 0 : 1,
      warningCount: doctor.warningCount,
    },
    inventory: {
      ok: inventory.ok,
      summary: inventory.summary,
      systemMapCoverage: inventory.systemMapCoverage,
    },
    productionReadiness: {
      ok: production.ok,
      summary: production.summary,
      warningCount: production.warningCount,
    },
    git: {
      dirty: dirtyFiles.length > 0,
      dirtyFiles,
    },
    evidence: {
      latest: evidenceReports[0] || null,
      latestFull: latestFullEvidence || null,
      reportCount: evidenceReports.length,
    },
    workflows: {
      aiMaintenance: fs.existsSync(
        path.join(root, ".github/workflows/ai-maintenance.yml")
      ),
    },
    nextActions,
  }

  if (options.writeReport) {
    const reportDir = path.join(root, ".ai-trace/status")
    fs.mkdirSync(reportDir, { recursive: true })
    const reportPath = path.join(
      reportDir,
      `${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    )
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
    report.reportPath = path.relative(root, reportPath)
  }

  return report
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Set(process.argv.slice(2))
  const report = await createStatusReport({ writeReport: args.has("--write") })

  console.log(JSON.stringify(report, null, 2))

  if (!report.ok) {
    process.exit(1)
  }
}
