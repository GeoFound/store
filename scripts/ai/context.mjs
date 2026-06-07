import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { createInventoryReport } from "./inventory.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"))
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

const system = readJson(".ai/system.json")
const taskbook = readJson(".ai/taskbook.json")
const evidencePolicy = readJson(".ai/evidence-policy.json")
const systemMap = readJson(".ai/system-map.json")
const decisionRecords = readJsonFiles(".ai/decision-records")
const reviewChecklists = readJsonFiles(".ai/review-checklists")
const packageJson = readJson("package.json")
const inventoryReport = createInventoryReport()
const gitHead = run("git", ["rev-parse", "--short", "HEAD"])
const gitBranch = run("git", ["branch", "--show-current"])
const gitStatus = run("git", ["status", "--short"])

const context = {
  generatedAt: new Date().toISOString(),
  repository: system.repository,
  product: system.product,
  operatingModel: system.operatingModel,
  evidencePolicy: system.evidencePolicy,
  decisionGates: system.decisionGates,
  systemMap: {
    nodes: systemMap.nodes?.map((node) => ({
      id: node.id,
      kind: node.kind,
      path: node.path,
      goal: node.goal,
      owns: node.owns,
      verification: node.verification,
    })) || [],
    flows: systemMap.flows || [],
    rules: systemMap.rules || [],
  },
  decisionRecords: decisionRecords.map((record) => ({
    path: record.path,
    id: record.data.id,
    status: record.data.status,
    title: record.data.title,
    decision: record.data.decision,
    evidence: record.data.evidence,
  })),
  reviewChecklists: reviewChecklists.map((checklist) => ({
    path: checklist.path,
    id: checklist.data.id,
    title: checklist.data.title,
    scope: checklist.data.scope,
    itemCount: checklist.data.items?.length || 0,
    humanGate: checklist.data.humanGate === true,
  })),
  inventory: {
    ok: inventoryReport.ok,
    summary: inventoryReport.summary,
    systemMapCoverage: inventoryReport.systemMapCoverage,
  },
  coldStart: system.coldStart,
  tasks: taskbook.tasks.map((task) => ({
    id: task.id,
    goal: task.goal,
    owner: task.owner,
    trigger: task.trigger,
    commands: task.commands,
    evidence: task.evidence,
  })),
  packageScripts: packageJson.scripts,
  evidenceCommands: {
    default: evidencePolicy.defaultChecks,
    full: evidencePolicy.fullChecks,
    production: evidencePolicy.productionChecks,
  },
  git: {
    branch: gitBranch.stdout || null,
    head: gitHead.stdout || null,
    dirty: Boolean(gitStatus.stdout),
    status: gitStatus.stdout.split("\n").filter(Boolean),
  },
}

console.log(JSON.stringify(context, null, 2))
