import type {
  OpsControlFinding,
  OpsControlSection,
  OpsControlSetting,
  OpsControlStatus,
} from "./types"

type Env = Record<string, string | undefined>

type SettingInput = Omit<
  OpsControlSetting,
  "key" | "configured" | "value" | "status" | "editable" | "secret"
> & {
  recommended?: boolean | string | number | null
  secret?: boolean
}

export function createAiOpsSnapshot(input?: { env?: Env }): OpsControlSection {
  const env = input?.env || process.env
  const settings: OpsControlSetting[] = [
    boolSetting("AI_ENABLED", env.AI_ENABLED, {
      label: "AI runtime enabled",
      owner: "ai-core",
      scope: "ai",
      recommended: false,
    }),
    valueSetting("AI_DEFAULT_PROVIDER", env.AI_DEFAULT_PROVIDER, {
      label: "Default AI provider",
      owner: "ai-core",
      scope: "ai",
      recommended: null,
    }),
    valueSetting("AI_PROVIDER_CONFIGS_JSON", env.AI_PROVIDER_CONFIGS_JSON, {
      label: "AI provider configs",
      owner: "ai-core",
      scope: "ai",
      recommended: null,
      secret: true,
    }),
    boolSetting("OPS_AI_REVIEW_ENABLED", env.OPS_AI_REVIEW_ENABLED, {
      label: "AI operations review",
      owner: "ops-control",
      scope: "ai",
      recommended: true,
    }),
    boolSetting(
      "OPS_AI_AUTO_REMEDIATE_ENABLED",
      env.OPS_AI_AUTO_REMEDIATE_ENABLED,
      {
        label: "AI auto remediation",
        owner: "ops-control",
        scope: "ai",
        recommended: false,
        notes: "Keep false unless a narrow command allow-list and approval gate are installed.",
      }
    ),
  ]
  const findings = createAiOpsFindings(env)

  return section({
    settings,
    findings,
    summary: {
      ai_enabled: truthy(env.AI_ENABLED),
      ai_ops_review_enabled: truthy(env.OPS_AI_REVIEW_ENABLED),
      auto_remediation_enabled: truthy(env.OPS_AI_AUTO_REMEDIATE_ENABLED),
    },
  })
}

function createAiOpsFindings(env: Env): OpsControlFinding[] {
  const findings: OpsControlFinding[] = []

  if (truthy(env.OPS_AI_AUTO_REMEDIATE_ENABLED)) {
    findings.push(finding({
      id: "ai-ops.auto-remediate-enabled",
      severity: "critical",
      owner: "ops-control",
      title: "AI auto remediation is enabled",
      detail: "Production AI maintenance should remain evidence-first with human confirmation for high-risk actions.",
      recommended_action: "Set OPS_AI_AUTO_REMEDIATE_ENABLED=false unless an audited allow-list and approval flow are active.",
      human_gate: true,
    }))
  }

  if (!truthy(env.OPS_AI_REVIEW_ENABLED)) {
    findings.push(finding({
      id: "ai-ops.review-disabled",
      severity: "warning",
      owner: "ops-control",
      title: "AI operations review is not marked enabled",
      detail: "The backend will expose the ops review task, but scheduled review evidence is not marked active.",
      recommended_action: "Run AI maintenance review from evidence snapshots and set OPS_AI_REVIEW_ENABLED=true after scheduling.",
      human_gate: false,
    }))
  }

  return findings
}

function valueSetting(
  key: string,
  raw: string | undefined,
  input: SettingInput
): OpsControlSetting {
  const isSecret = input.secret === true
  const isConfigured = configured(raw)
  const value = isSecret ? null : raw || null
  const status = input.recommended === null || typeof input.recommended === "undefined"
    ? (isConfigured ? "ok" : "warning")
    : rawMatches(raw, input.recommended)
      ? "ok"
      : "warning"

  return {
    key,
    label: input.label,
    owner: input.owner,
    scope: input.scope,
    configured: isConfigured,
    secret: isSecret,
    value,
    recommended: input.recommended,
    status,
    editable: false,
    notes: input.notes,
  }
}

function boolSetting(
  key: string,
  raw: string | undefined,
  input: Omit<SettingInput, "secret" | "recommended"> & {
    recommended?: boolean
  }
): OpsControlSetting {
  const isConfigured = configured(raw)
  const value = isConfigured ? truthy(raw) : null
  const status = typeof input.recommended === "boolean"
    ? value === input.recommended
      ? "ok"
      : "warning"
    : isConfigured
      ? "ok"
      : "warning"

  return {
    key,
    label: input.label,
    owner: input.owner,
    scope: input.scope,
    configured: isConfigured,
    secret: false,
    value,
    recommended: input.recommended,
    status,
    editable: false,
    notes: input.notes,
  }
}

function section(input: {
  settings: OpsControlSetting[]
  findings: OpsControlFinding[]
  summary: Record<string, unknown>
}): OpsControlSection {
  return {
    status: summarizeStatus([
      ...input.findings.map((entry) =>
        entry.severity === "critical" ? "critical" : "warning"
      ),
      ...input.settings.map((entry) => entry.status),
    ]),
    summary: input.summary,
    settings: input.settings,
    findings: input.findings,
  }
}

function finding(input: OpsControlFinding): OpsControlFinding {
  return input
}

function configured(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
}

function normalized(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function truthy(value: unknown) {
  return ["1", "true", "yes", "on"].includes(normalized(value))
}

function rawMatches(value: unknown, recommended: string | boolean | number | null) {
  if (recommended === null) {
    return configured(value)
  }

  if (typeof recommended === "boolean") {
    return truthy(value) === recommended
  }

  return normalized(value) === String(recommended).trim().toLowerCase()
}

function summarizeStatus(statuses: OpsControlStatus[]): OpsControlStatus {
  if (statuses.includes("critical")) {
    return "critical"
  }

  if (statuses.includes("warning")) {
    return "warning"
  }

  if (statuses.includes("disabled")) {
    return "disabled"
  }

  return "ok"
}
