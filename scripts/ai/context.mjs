import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"))
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
const packageJson = readJson("package.json")
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
