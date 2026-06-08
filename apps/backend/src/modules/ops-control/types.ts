export type OpsControlStatus = "ok" | "warning" | "critical" | "disabled"

export type OpsControlSetting = {
  key: string
  label: string
  owner: string
  scope: "backend" | "storefront" | "deploy" | "cloudflare" | "vps" | "ai"
  configured: boolean
  secret: boolean
  value: string | boolean | number | null
  recommended?: string | boolean | number | null
  status: OpsControlStatus
  editable: false
  notes?: string
}

export type OpsControlFinding = {
  id: string
  severity: "info" | "warning" | "critical"
  owner: string
  title: string
  detail: string
  recommended_action: string
  human_gate: boolean
}

export type OpsControlSection = {
  status: OpsControlStatus
  summary: Record<string, unknown>
  settings: OpsControlSetting[]
  findings: OpsControlFinding[]
}

export type OpsControlDashboardSnapshot = {
  generated_at: string
  module: "ops-control"
  summary: {
    status: OpsControlStatus
    critical_findings: number
    warning_findings: number
    human_gate_actions: number
  }
  security: OpsControlSection
  maintenance: OpsControlSection
  ai_ops: OpsControlSection
  findings: OpsControlFinding[]
  operator_actions: Array<{
    id: string
    title: string
    risk: "low" | "medium" | "high"
    requires_human_confirmation: boolean
    available_now: boolean
    evidence_required: string[]
  }>
}
