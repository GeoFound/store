#!/usr/bin/env node
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const policy = readJson(".ai/site-lifecycle-policy.json")

function usage() {
  console.log(`usage:
  node scripts/site/lifecycle.mjs validate --site-id <id> --site-env <env>
  node scripts/site/lifecycle.mjs validate-all
  node scripts/site/lifecycle.mjs evidence --site-id <id> --site-env <env> [--write]
  node scripts/site/lifecycle.mjs evidence-all [--write]
  node scripts/site/lifecycle.mjs gate --site-id <id> --site-env <env> [--write]
`)
}

function parseArgs(argv) {
  const args = {
    command: argv[0] || "validate",
    siteId: "",
    siteEnv: "production",
    profileRoot: policy.profileRoot || "profiles/sites",
    write: false,
  }

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--") {
      continue
    }

    if (arg === "--site-id" || arg === "--site") {
      args.siteId = argv[index + 1] || ""
      index += 1
      continue
    }

    if (arg === "--site-env" || arg === "--env") {
      args.siteEnv = argv[index + 1] || ""
      index += 1
      continue
    }

    if (arg === "--profile-root") {
      args.profileRoot = argv[index + 1] || ""
      index += 1
      continue
    }

    if (arg === "--write") {
      args.write = true
      continue
    }

    if (arg === "-h" || arg === "--help") {
      usage()
      process.exit(0)
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return args
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.command === "validate") {
    const report = validateOne(args)
    printReport(report)
    process.exit(report.ok ? 0 : 1)
  }

  if (args.command === "validate-all") {
    const report = validateAll(args)
    printReport(report)
    process.exit(report.ok ? 0 : 1)
  }

  if (args.command === "evidence") {
    const report = createEvidence(args)
    maybeWriteEvidence(report, args)
    printReport(report)
    process.exit(report.ok ? 0 : 1)
  }

  if (args.command === "evidence-all") {
    const report = createEvidenceAll(args)
    printReport(report)
    process.exit(report.ok ? 0 : 1)
  }

  if (args.command === "gate") {
    const report = createEvidence(args)
    maybeWriteEvidence(report, args)
    printReport(report)
    process.exit(report.ok && report.ready_for_promotion ? 0 : 1)
  }

  throw new Error(`Unknown command: ${args.command}`)
}

function validateOne(args) {
  const profilePath = profileFilePath(args.profileRoot, args.siteId, args.siteEnv)
  const issues = []
  const warnings = []

  if (!args.siteId) {
    issues.push(issue("site.id-missing", "site id is required"))
  }

  if (!args.siteEnv) {
    issues.push(issue("site.env-missing", "site env is required"))
  }

  const profile = readProfile(profilePath, issues)

  if (profile) {
    validateProfileContract(profile, args, issues, warnings)
    validateSiteSet(args.profileRoot, args.siteId, issues, warnings)
  }

  return {
    ok: issues.length === 0,
    kind: "site-lifecycle-validation",
    generated_at: now(),
    site_id: args.siteId,
    site_env: args.siteEnv,
    profile_path: relative(profilePath),
    issue_count: issues.length,
    warning_count: warnings.length,
    issues,
    warnings,
  }
}

function validateAll(args) {
  const issues = []
  const warnings = []
  const profileRoot = path.resolve(root, args.profileRoot)
  const sites = listSiteIds(args.profileRoot)
  const reports = []

  if (!sites.length) {
    issues.push(issue("site-profiles.empty", "No site profiles found"))
  }

  for (const siteId of sites) {
    validateSiteSet(args.profileRoot, siteId, issues, warnings)

    for (const siteEnv of listSiteEnvs(args.profileRoot, siteId)) {
      const report = validateOne({
        ...args,
        siteId,
        siteEnv,
      })
      reports.push(report)
      issues.push(...report.issues.map((entry) => scopedIssue(siteId, siteEnv, entry)))
      warnings.push(
        ...report.warnings.map((entry) => scopedIssue(siteId, siteEnv, entry))
      )
    }
  }

  return {
    ok: issues.length === 0,
    kind: "site-lifecycle-validation-all",
    generated_at: now(),
    profile_root: relative(profileRoot),
    site_count: sites.length,
    profile_count: reports.length,
    issue_count: issues.length,
    warning_count: warnings.length,
    sites,
    issues,
    warnings,
  }
}

function createEvidence(args) {
  const validation = validateOne(args)
  const profilePath = profileFilePath(args.profileRoot, args.siteId, args.siteEnv)
  const profile = validation.ok
    ? readProfile(profilePath, [])
    : null
  const blockers = []
  const warnings = [...validation.warnings]
  const lifecycle = profile?.lifecycle || {}
  const evidence = lifecycle.evidence || {}
  const policyForEnv = policy.environmentPolicies?.[args.siteEnv] || {}
  const profileHash = fs.existsSync(profilePath)
    ? sha256(fs.readFileSync(profilePath, "utf8"))
    : ""

  if (validation.issues.length) {
    blockers.push(...validation.issues.map((entry) => entry.id))
  }

  if (policyForEnv.runtimeEvidenceRequired) {
    for (const field of policy.promotionEvidenceFields || []) {
      if (!hasText(evidence[field])) {
        blockers.push(`runtime-evidence-missing:${field}`)
      }
    }
  }

  if (args.siteEnv === "production") {
    for (const field of policy.productionOnlyEvidenceFields || []) {
      if (!hasText(evidence[field])) {
        blockers.push(`production-evidence-missing:${field}`)
      }
    }

    if (lifecycle.data_policy?.real_user_data_allowed !== true) {
      blockers.push("production-real-user-data-disabled")
    }

    if (
      lifecycle.data_policy?.production_real_tenant_evidence_allowed === true &&
      !hasText(evidence.human_gate_ref)
    ) {
      blockers.push("production-real-tenant-evidence-without-human-gate")
    }

    if (
      lifecycle.data_policy?.graph_production_write_enabled === true &&
      !hasText(evidence.human_gate_ref)
    ) {
      blockers.push("graph-production-write-without-human-gate")
    }
  }

  const report = {
    ok: validation.ok,
    kind: "site-lifecycle-evidence-report",
    generated_at: now(),
    site_id: args.siteId,
    site_env: args.siteEnv,
    profile_path: relative(profilePath),
    profile_sha256: profileHash,
    site_launch_contract_version: lifecycle.site_launch_contract_version || null,
    static_contract_valid: validation.ok,
    ready_for_promotion: validation.ok && blockers.length === 0,
    production_write_enabled: lifecycle.data_policy?.real_user_data_allowed === true,
    graph_production_write_enabled:
      lifecycle.data_policy?.graph_production_write_enabled === true,
    production_real_tenant_evidence_allowed:
      lifecycle.data_policy?.production_real_tenant_evidence_allowed === true,
    required_static_commands:
      lifecycle.evidence?.required_static_commands ||
      policy.requiredStaticCommands ||
      [],
    required_runtime_commands:
      lifecycle.evidence?.required_runtime_commands ||
      policy.requiredRuntimeCommands ||
      [],
    runtime_evidence: collectEvidenceFields(evidence, [
      ...(policy.promotionEvidenceFields || []),
      ...(args.siteEnv === "production"
        ? policy.productionOnlyEvidenceFields || []
        : []),
    ]),
    blockers: Array.from(new Set(blockers)).sort(),
    issue_count: validation.issues.length,
    warning_count: warnings.length,
    issues: validation.issues,
    warnings,
  }

  return report
}

function createEvidenceAll(args) {
  const profileRoot = args.profileRoot
  const reports = []
  const issues = []

  for (const siteId of listSiteIds(profileRoot)) {
    for (const siteEnv of listSiteEnvs(profileRoot, siteId)) {
      const report = createEvidence({
        ...args,
        siteId,
        siteEnv,
      })
      reports.push(report)

      if (args.write) {
        maybeWriteEvidence(report, { ...args, siteId, siteEnv })
      }

      if (!report.ok) {
        issues.push(...report.issues.map((entry) => scopedIssue(siteId, siteEnv, entry)))
      }
    }
  }

  return {
    ok: issues.length === 0,
    kind: "site-lifecycle-evidence-all",
    generated_at: now(),
    report_count: reports.length,
    ready_for_promotion_count: reports.filter((report) => report.ready_for_promotion).length,
    blocked_count: reports.filter((report) => report.blockers.length > 0).length,
    issues,
    reports: reports.map((report) => ({
      site_id: report.site_id,
      site_env: report.site_env,
      ok: report.ok,
      ready_for_promotion: report.ready_for_promotion,
      blocker_count: report.blockers.length,
      blockers: report.blockers,
      report_path: report.report_path,
    })),
  }
}

function validateProfileContract(profile, args, issues, warnings) {
  if (profile?.site?.id !== args.siteId) {
    issues.push(
      issue(
        "site.id-mismatch",
        `site.id must equal ${args.siteId}`,
        "site.id"
      )
    )
  }

  const lifecycle = profile.lifecycle

  if (!lifecycle || typeof lifecycle !== "object" || Array.isArray(lifecycle)) {
    issues.push(issue("lifecycle.missing", "profile.lifecycle is required", "lifecycle"))
    return
  }

  assertText(
    lifecycle.site_launch_contract_version,
    "lifecycle.site_launch_contract_version",
    issues
  )

  if (lifecycle.site_launch_contract_version !== policy.version) {
    issues.push(
      issue(
        "lifecycle.version-mismatch",
        `site launch contract version must be ${policy.version}`,
        "lifecycle.site_launch_contract_version"
      )
    )
  }

  if (lifecycle.environment !== args.siteEnv) {
    issues.push(
      issue(
        "lifecycle.environment-mismatch",
        `lifecycle.environment must equal ${args.siteEnv}`,
        "lifecycle.environment"
      )
    )
  }

  const envPolicy = policy.environmentPolicies?.[args.siteEnv]

  if (!envPolicy) {
    issues.push(
      issue(
        "lifecycle.environment-unsupported",
        `Unsupported site environment ${args.siteEnv}`,
        "lifecycle.environment"
      )
    )
  }

  validateDataPolicy(lifecycle.data_policy, args, envPolicy || {}, issues)
  validateControls(lifecycle.controls, args, envPolicy || {}, issues)
  validateEvidenceContract(lifecycle.evidence, envPolicy || {}, issues, warnings)
}

function validateDataPolicy(dataPolicy, args, envPolicy, issues) {
  if (!dataPolicy || typeof dataPolicy !== "object" || Array.isArray(dataPolicy)) {
    issues.push(
      issue("lifecycle.data-policy-missing", "lifecycle.data_policy is required", "lifecycle.data_policy")
    )
    return
  }

  for (const key of [
    "real_user_data_allowed",
    "production_real_tenant_evidence_allowed",
    "graph_production_write_enabled",
    "supplier_auto_procurement_enabled",
  ]) {
    assertBoolean(dataPolicy[key], `lifecycle.data_policy.${key}`, issues)
  }

  assertText(dataPolicy.graph_mode, "lifecycle.data_policy.graph_mode", issues)
  assertText(dataPolicy.payment_mode, "lifecycle.data_policy.payment_mode", issues)
  assertText(
    dataPolicy.out_of_stock_checkout_policy,
    "lifecycle.data_policy.out_of_stock_checkout_policy",
    issues
  )

  if (!(policy.allowedGraphModes || []).includes(dataPolicy.graph_mode)) {
    issues.push(
      issue(
        "lifecycle.graph-mode-invalid",
        `graph_mode must be one of ${(policy.allowedGraphModes || []).join(", ")}`,
        "lifecycle.data_policy.graph_mode"
      )
    )
  }

  if (
    !(policy.allowedOutOfStockCheckoutPolicies || []).includes(
      dataPolicy.out_of_stock_checkout_policy
    )
  ) {
    issues.push(
      issue(
        "lifecycle.out-of-stock-checkout-policy-invalid",
        `out_of_stock_checkout_policy must be one of ${(policy.allowedOutOfStockCheckoutPolicies || []).join(", ")}`,
        "lifecycle.data_policy.out_of_stock_checkout_policy"
      )
    )
  }

  if (
    envPolicy.realUserDataAllowed === false &&
    dataPolicy.real_user_data_allowed !== false
  ) {
    issues.push(
      issue(
        "lifecycle.real-user-data-not-allowed",
        `${args.siteEnv} must not allow real user data`,
        "lifecycle.data_policy.real_user_data_allowed"
      )
    )
  }

  if (
    envPolicy.productionRealTenantEvidenceAllowed === false &&
    dataPolicy.production_real_tenant_evidence_allowed !== false
  ) {
    issues.push(
      issue(
        "lifecycle.production-real-tenant-evidence-not-allowed",
        `${args.siteEnv} must not claim production_real_tenant evidence`,
        "lifecycle.data_policy.production_real_tenant_evidence_allowed"
      )
    )
  }

  if (
    envPolicy.graphProductionWriteEnabled === false &&
    dataPolicy.graph_production_write_enabled !== false
  ) {
    issues.push(
      issue(
        "lifecycle.graph-production-write-not-allowed",
        `${args.siteEnv} must not enable graph production writes`,
        "lifecycle.data_policy.graph_production_write_enabled"
      )
    )
  }
}

function validateControls(controls, args, envPolicy, issues) {
  if (!controls || typeof controls !== "object" || Array.isArray(controls)) {
    issues.push(
      issue("lifecycle.controls-missing", "lifecycle.controls is required", "lifecycle.controls")
    )
    return
  }

  for (const key of policy.requiredControls || []) {
    assertBoolean(controls[key], `lifecycle.controls.${key}`, issues)
  }

  if (envPolicy.runtimeEvidenceRequired) {
    for (const key of [
      "backend_control_panel_required",
      "cloudflare_required",
      "dns_required",
      "cloudflare_ssl_strict_required",
      "cloudflare_waf_required",
      "runtime_health_required",
      "edge_preflight_required",
      "admin_edge_protection_required",
      "redis_rate_limit_smoke_required",
      "payment_provider_required",
      "supplier_readiness_required",
      "delivery_inventory_required",
      "customer_access_required",
      "notification_readiness_required",
      "analytics_privacy_required",
      "regression_required",
      "backup_required",
      "restore_test_required",
      "rollback_required",
    ]) {
      if (controls[key] !== true) {
        issues.push(
          issue(
            "lifecycle.runtime-control-disabled",
            `${args.siteEnv} requires ${key}=true`,
            `lifecycle.controls.${key}`
          )
        )
      }
    }
  }

  if (envPolicy.humanGateRequired && controls.human_gate_required !== true) {
    issues.push(
      issue(
        "lifecycle.human-gate-required",
        `${args.siteEnv} requires human_gate_required=true`,
        "lifecycle.controls.human_gate_required"
      )
    )
  }

  if (args.siteEnv === "production" && controls.staging_required !== true) {
    issues.push(
      issue(
        "lifecycle.staging-required",
        "production requires staging_required=true",
        "lifecycle.controls.staging_required"
      )
    )
  }
}

function validateEvidenceContract(evidence, envPolicy, issues, warnings) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    issues.push(
      issue("lifecycle.evidence-missing", "lifecycle.evidence is required", "lifecycle.evidence")
    )
    return
  }

  for (const key of ["required_static_commands", "required_runtime_commands"]) {
    const required = key === "required_runtime_commands"
      ? envPolicy.runtimeEvidenceRequired === true
      : true

    if (!Array.isArray(evidence[key]) || (required && evidence[key].length === 0)) {
      issues.push(
        issue(
          "lifecycle.evidence-commands-missing",
          required ? `${key} must be a non-empty array` : `${key} must be an array`,
          `lifecycle.evidence.${key}`
        )
      )
      continue
    }

    for (const command of evidence[key]) {
      if (!hasText(command)) {
        issues.push(
          issue(
            "lifecycle.evidence-command-invalid",
            `${key} entries must be non-empty strings`,
            `lifecycle.evidence.${key}`
          )
        )
      }
    }

    const policyCommands = key === "required_runtime_commands"
      ? policy.requiredRuntimeCommands || []
      : policy.requiredStaticCommands || []

    const enforcePolicyCommandCoverage = key === "required_runtime_commands"
      ? required
      : envPolicy.runtimeEvidenceRequired === true || envPolicy.humanGateRequired === true

    if (enforcePolicyCommandCoverage) {
      for (const command of policyCommands) {
        if (!evidence[key].includes(command)) {
          issues.push(
            issue(
              "lifecycle.evidence-command-missing-policy-command",
              `${key} must include ${command}`,
              `lifecycle.evidence.${key}`
            )
          )
        }
      }
    }
  }

  for (const field of [
    ...(policy.promotionEvidenceFields || []),
    ...(policy.productionOnlyEvidenceFields || []),
  ]) {
    if (typeof evidence[field] !== "string" && evidence[field] !== null) {
      warnings.push(
        issue(
          "lifecycle.evidence-ref-non-string",
          `${field} should be a string evidence ref or null`,
          `lifecycle.evidence.${field}`
        )
      )
    }
  }
}

function validateSiteSet(profileRoot, siteId, issues, warnings) {
  if (!siteId) {
    return
  }

  for (const siteEnv of policy.requiredProfilesPerSite || []) {
    const filePath = profileFilePath(profileRoot, siteId, siteEnv)

    if (!fs.existsSync(filePath)) {
      issues.push(
        issue(
          "site-profile.required-env-missing",
          `Site ${siteId} is missing ${siteEnv} profile`,
          relative(filePath)
        )
      )
    }
  }

  const observed = listSiteEnvs(profileRoot, siteId)
  const required = new Set(policy.requiredProfilesPerSite || [])

  for (const siteEnv of observed) {
    if (!required.has(siteEnv)) {
      warnings.push(
        issue(
          "site-profile.unmanaged-env",
          `Site ${siteId} has an environment not declared in site lifecycle policy`,
          `profiles/sites/${siteId}/${siteEnv}`
        )
      )
    }
  }
}

function collectEvidenceFields(evidence, fields) {
  return Object.fromEntries(
    fields.map((field) => [
      field,
      {
        required: true,
        ref: hasText(evidence[field]) ? evidence[field] : null,
        present: hasText(evidence[field]),
      },
    ])
  )
}

function maybeWriteEvidence(report, args) {
  if (!args.write) {
    return
  }

  const reportDir = path.join(
    root,
    policy.evidenceDirectory || ".ai-trace/sites",
    args.siteId,
    args.siteEnv
  )
  fs.mkdirSync(reportDir, { recursive: true })
  const reportPath = path.join(
    reportDir,
    `${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  )
  const withPath = {
    ...report,
    report_path: relative(reportPath),
  }

  fs.writeFileSync(reportPath, `${JSON.stringify(withPath, null, 2)}\n`)
  report.report_path = withPath.report_path
}

function listSiteIds(profileRoot) {
  const absoluteRoot = path.resolve(root, profileRoot)

  if (!fs.existsSync(absoluteRoot)) {
    return []
  }

  return fs.readdirSync(absoluteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function listSiteEnvs(profileRoot, siteId) {
  const siteRoot = path.resolve(root, profileRoot, siteId)

  if (!fs.existsSync(siteRoot)) {
    return []
  }

  return fs.readdirSync(siteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => fs.existsSync(path.join(siteRoot, entry.name, "site.json")))
    .map((entry) => entry.name)
    .sort()
}

function profileFilePath(profileRoot, siteId, siteEnv) {
  return path.resolve(root, profileRoot, siteId, siteEnv, "site.json")
}

function readProfile(filePath, issues) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch (error) {
    issues.push(
      issue(
        "site-profile.invalid-json",
        error instanceof Error ? error.message : String(error),
        relative(filePath)
      )
    )
    return null
  }
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"))
}

function assertText(value, field, issues) {
  if (!hasText(value)) {
    issues.push(issue("field.required", `${field} is required`, field))
  }
}

function assertBoolean(value, field, issues) {
  if (typeof value !== "boolean") {
    issues.push(issue("field.boolean-required", `${field} must be boolean`, field))
  }
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0
}

function issue(id, message, field = "") {
  return {
    id,
    message,
    ...(field ? { field } : {}),
  }
}

function scopedIssue(siteId, siteEnv, entry) {
  return {
    ...entry,
    site_id: siteId,
    site_env: siteEnv,
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function now() {
  return new Date().toISOString()
}

function relative(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/")
}

function printReport(report) {
  console.log(JSON.stringify(report, null, 2))
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(2)
}
