export type OpsControlStatus = "ok" | "warning" | "critical" | "disabled"

export type OpsControlSetting = {
  key: string
  label: string
  owner: string
  scope:
    | "backend"
    | "storefront"
    | "deploy"
    | "cloudflare"
    | "vps"
    | "ai"
    | "payment"
    | "supplier"
    | "customer"
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

export type OpsControlPolicySurface = {
  id: string
  title: string
  owner: string
  backend_panel_required: boolean
  production_gate_required: boolean
  human_choice_required: boolean
  admin_route: string
  control_panel_section: string
  profile_controls: string[]
  evidence_fields: string[]
  runtime_commands: string[]
  config_keys: string[]
}

export type OpsControlDashboardSnapshot = {
  generated_at: string
  module: "ops-control"
  summary: {
    status: OpsControlStatus
    critical_findings: number
    warning_findings: number
    human_gate_actions: number
    control_panel_surface_count: number
    gated_surface_count: number
  }
  launch_readiness: OpsControlSection
  security: OpsControlSection
  maintenance: OpsControlSection
  customer: OpsControlSection
  commerce: OpsControlSection
  ai_ops: OpsControlSection
  control_panel_policy: {
    version: string
    production_control_rule: string
    forbidden_surface_count: number
    required_surfaces: OpsControlPolicySurface[]
  }
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
