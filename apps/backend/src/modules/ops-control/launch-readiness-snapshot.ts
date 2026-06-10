import { ADMIN_CONTROL_PANEL_POLICY } from "../../platform/admin-control-panel-policy"
import type {
  OpsControlDashboardSnapshot,
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
  secret?: boolean
}

const SECRET_KEYS = new Set(["CLOUDFLARE_API_TOKEN"])

export function createLaunchReadinessSnapshot(input?: { env?: Env }): OpsControlSection {
  const env = input?.env || process.env
  const settings: OpsControlSetting[] = [
    valueSetting("SITE_ID", env.SITE_ID, {
      label: "Site id",
      owner: "profile-system",
      scope: "deploy",
      recommended: null,
    }),
    valueSetting("SITE_ENV", env.SITE_ENV, {
      label: "Site environment",
      owner: "profile-system",
      scope: "deploy",
      recommended: env.NODE_ENV === "production" ? "production" : null,
    }),
    valueSetting("TENANCY_MODE", env.TENANCY_MODE, {
      label: "Tenancy mode",
      owner: "tenant-runtime",
      scope: "deploy",
      recommended: null,
    }),
    valueSetting("TENANT_ALLOWED_HOSTS", env.TENANT_ALLOWED_HOSTS, {
      label: "Tenant allowed hosts",
      owner: "tenant-runtime",
      scope: "deploy",
      recommended: null,
    }),
    valueSetting("STOREFRONT_PUBLIC_URL", env.STOREFRONT_PUBLIC_URL, {
      label: "Public storefront URL",
      owner: "ops-control",
      scope: "deploy",
      recommended: null,
    }),
    valueSetting("API_PUBLIC_URL", env.API_PUBLIC_URL, {
      label: "Public API URL",
      owner: "ops-control",
      scope: "deploy",
      recommended: null,
    }),
    boolSetting("EXPECT_CLOUDFLARE", env.EXPECT_CLOUDFLARE, {
      label: "Expect Cloudflare edge",
      owner: "ops-control",
      scope: "cloudflare",
      recommended: true,
    }),
    valueSetting("REQUIRE_CLOUDFLARE_SSL_MODE", env.REQUIRE_CLOUDFLARE_SSL_MODE, {
      label: "Required Cloudflare SSL mode",
      owner: "ops-control",
      scope: "cloudflare",
      recommended: "strict",
    }),
    valueSetting("CLOUDFLARE_ZONE_ID", env.CLOUDFLARE_ZONE_ID, {
      label: "Cloudflare zone id",
      owner: "ops-control",
      scope: "cloudflare",
      recommended: null,
    }),
    secretSetting("CLOUDFLARE_API_TOKEN", env.CLOUDFLARE_API_TOKEN, {
      label: "Cloudflare API token",
      owner: "ops-control",
      scope: "cloudflare",
    }),
    boolSetting(
      "CLOUDFLARE_WAF_MANAGED_RULES_ENABLED",
      env.CLOUDFLARE_WAF_MANAGED_RULES_ENABLED,
      {
        label: "Cloudflare managed WAF rules",
        owner: "ops-control",
        scope: "cloudflare",
        recommended: true,
      }
    ),
    boolSetting(
      "CLOUDFLARE_ACCESS_ADMIN_ENABLED",
      env.CLOUDFLARE_ACCESS_ADMIN_ENABLED,
      {
        label: "Cloudflare Access for admin",
        owner: "ops-control",
        scope: "cloudflare",
        recommended: true,
      }
    ),
  ]
  const findings = createLaunchFindings(env)

  return section({
    settings,
    findings,
    summary: {
      required_surface_count:
        ADMIN_CONTROL_PANEL_POLICY.requiredProductionSurfaces.length,
      production_gate_surface_count:
        ADMIN_CONTROL_PANEL_POLICY.requiredProductionSurfaces.filter(
          (surface) => surface.productionGateRequired
        ).length,
      cloudflare_expected: truthy(env.EXPECT_CLOUDFLARE),
      waf_marked_enabled: truthy(env.CLOUDFLARE_WAF_MANAGED_RULES_ENABLED),
      admin_access_marked_enabled: truthy(env.CLOUDFLARE_ACCESS_ADMIN_ENABLED),
    },
  })
}

export function createControlPanelPolicySnapshot(): OpsControlDashboardSnapshot["control_panel_policy"] {
  return {
    version: ADMIN_CONTROL_PANEL_POLICY.version,
    production_control_rule: ADMIN_CONTROL_PANEL_POLICY.productionControlRule,
    information_architecture: {
      default_admin_route:
        ADMIN_CONTROL_PANEL_POLICY.informationArchitecture.defaultAdminRoute,
      route_prefix: ADMIN_CONTROL_PANEL_POLICY.informationArchitecture.routePrefix,
      section_order:
        ADMIN_CONTROL_PANEL_POLICY.informationArchitecture.sectionOrder.map(
          (section) => ({
            id: section.id,
            title: section.title,
            description: section.description,
          })
        ),
      route_placements:
        ADMIN_CONTROL_PANEL_POLICY.informationArchitecture.routePlacements.map(
          (placement) => ({
            route: placement.route,
            section: placement.section,
            title: placement.title,
            owner: placement.owner,
            purpose: placement.purpose,
          })
        ),
      extension_placement_rule:
        ADMIN_CONTROL_PANEL_POLICY.informationArchitecture.extensionPlacementRule,
    },
    forbidden_surface_count: ADMIN_CONTROL_PANEL_POLICY.forbiddenSurface.length,
    required_surfaces: ADMIN_CONTROL_PANEL_POLICY.requiredProductionSurfaces.map(
      (surface) => ({
        id: surface.id,
        title: surface.title,
        owner: surface.owner,
        backend_panel_required: surface.backendPanelRequired,
        production_gate_required: surface.productionGateRequired,
        human_choice_required: surface.humanChoiceRequired,
        admin_route: surface.adminRoute,
        control_panel_section: surface.controlPanelSection,
        profile_controls: [...surface.profileControls],
        evidence_fields: [...surface.evidenceFields],
        runtime_commands: [...surface.runtimeCommands],
        config_keys: [...surface.configKeys],
      })
    ),
  }
}

function createLaunchFindings(env: Env): OpsControlFinding[] {
  const findings: OpsControlFinding[] = []
  const production = env.NODE_ENV === "production"

  if (production && !configured(env.STOREFRONT_PUBLIC_URL)) {
    findings.push(finding({
      id: "launch.storefront-public-url-missing",
      severity: "critical",
      owner: "ops-control",
      title: "Public storefront URL is missing",
      detail: "Production edge checks cannot prove DNS, HTTPS, or health without STOREFRONT_PUBLIC_URL.",
      recommended_action: "Set STOREFRONT_PUBLIC_URL to the production HTTPS storefront origin before running deploy preflights.",
      human_gate: true,
    }))
  }

  if (production && !configured(env.API_PUBLIC_URL)) {
    findings.push(finding({
      id: "launch.api-public-url-missing",
      severity: "critical",
      owner: "ops-control",
      title: "Public API URL is missing",
      detail: "Production edge, admin Access, rate-limit, and webhook checks need API_PUBLIC_URL.",
      recommended_action: "Set API_PUBLIC_URL to the production HTTPS API origin before running deploy preflights.",
      human_gate: true,
    }))
  }

  if (production && !truthy(env.EXPECT_CLOUDFLARE)) {
    findings.push(finding({
      id: "launch.cloudflare-not-required",
      severity: "critical",
      owner: "ops-control",
      title: "Cloudflare is not required for production",
      detail: "The site lifecycle contract requires Cloudflare edge controls for production promotion.",
      recommended_action: "Set EXPECT_CLOUDFLARE=true and run pnpm deploy:dns plus pnpm deploy:edge.",
      human_gate: true,
    }))
  }

  if (truthy(env.EXPECT_CLOUDFLARE) && !configured(env.CLOUDFLARE_ZONE_ID)) {
    findings.push(finding({
      id: "launch.cloudflare-zone-id-missing",
      severity: "warning",
      owner: "ops-control",
      title: "Cloudflare zone id is missing",
      detail: "Header checks can still run, but DNS, SSL, and WAF API preflights need CLOUDFLARE_ZONE_ID.",
      recommended_action: "Set CLOUDFLARE_ZONE_ID for the production zone.",
      human_gate: true,
    }))
  }

  if (truthy(env.EXPECT_CLOUDFLARE) && !configured(env.CLOUDFLARE_API_TOKEN)) {
    findings.push(finding({
      id: "launch.cloudflare-api-token-missing",
      severity: "warning",
      owner: "ops-control",
      title: "Cloudflare API token is missing",
      detail: "DNS, SSL mode, and WAF managed-rules verification cannot use the Cloudflare API without a read token.",
      recommended_action: "Set a scoped Cloudflare token with DNS/rulesets/zone settings read access in deploy secrets.",
      human_gate: true,
    }))
  }

  return findings
}

function valueSetting(
  key: string,
  raw: string | undefined,
  input: SettingInput
): OpsControlSetting {
  const isSecret = input.secret ?? SECRET_KEYS.has(key)
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

function secretSetting(
  key: string,
  raw: string | undefined,
  input: Omit<SettingInput, "secret">
) {
  return valueSetting(key, raw, {
    ...input,
    secret: true,
  })
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
