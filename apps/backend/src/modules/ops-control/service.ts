import { createAiOpsSnapshot } from "./ai-ops-snapshot"
import { createCommerceSnapshot } from "./commerce-snapshot"
import { createCustomerSnapshot } from "./customer-snapshot"
import {
  createControlPanelPolicySnapshot,
  createLaunchReadinessSnapshot,
} from "./launch-readiness-snapshot"
import { OPERATOR_ACTIONS } from "./operator-actions"
import { ADMIN_CONTROL_PANEL_POLICY } from "../../platform/admin-control-panel-policy"
import type {
  OpsControlDashboardSnapshot,
  OpsControlFinding,
  OpsControlSection,
  OpsControlSetting,
  OpsControlStatus,
} from "./types"

type Env = Record<string, string | undefined>

const SECRET_KEYS = new Set([
  "CLOUDFLARE_API_TOKEN",
  "DATABASE_URL",
  "REDIS_URL",
  "SECURITY_RATE_LIMIT_REDIS_URL",
  "TURNSTILE_SECRET_KEY",
])

class OpsControlModuleService {
  getDashboardSnapshot(input?: { env?: Env }): OpsControlDashboardSnapshot {
    const env = input?.env || process.env
    const launchReadiness = createLaunchReadinessSnapshot({ env })
    const security = this.getSecuritySnapshot({ env })
    const maintenance = this.getMaintenanceSnapshot({ env })
    const customer = this.getCustomerSnapshot({ env })
    const commerce = this.getCommerceSnapshot({ env })
    const aiOps = createAiOpsSnapshot({ env })
    const findings = [
      ...launchReadiness.findings,
      ...security.findings,
      ...maintenance.findings,
      ...customer.findings,
      ...commerce.findings,
      ...aiOps.findings,
    ].sort(compareFindings)

    return {
      generated_at: new Date().toISOString(),
      module: "ops-control",
      summary: {
        status: summarizeStatus([
          launchReadiness.status,
          security.status,
          maintenance.status,
          customer.status,
          commerce.status,
          aiOps.status,
        ]),
        critical_findings: findings.filter((finding) => finding.severity === "critical").length,
        warning_findings: findings.filter((finding) => finding.severity === "warning").length,
        human_gate_actions: findings.filter((finding) => finding.human_gate).length,
        control_panel_surface_count:
          ADMIN_CONTROL_PANEL_POLICY.requiredProductionSurfaces.length,
        gated_surface_count:
          ADMIN_CONTROL_PANEL_POLICY.requiredProductionSurfaces.filter(
            (surface) => surface.productionGateRequired
          ).length,
      },
      launch_readiness: launchReadiness,
      security,
      maintenance,
      customer,
      commerce,
      ai_ops: aiOps,
      control_panel_policy: createControlPanelPolicySnapshot(),
      findings,
      operator_actions: OPERATOR_ACTIONS,
    }
  }

  getSecuritySnapshot(input?: { env?: Env }): OpsControlSection {
    const env = input?.env || process.env
    const settings: OpsControlSetting[] = [
      boolSetting(env, "SECURITY_HEADERS_ENABLED", {
        label: "Security headers",
        owner: "security-guard",
        scope: "backend",
        recommended: true,
      }),
      boolSetting(env, "SECURITY_ENFORCE_ORIGIN_CHECKS", {
        label: "Origin enforcement",
        owner: "security-guard",
        scope: "backend",
        recommended: true,
      }),
      valueSetting(env, "SECURITY_ALLOWED_ORIGINS", {
        label: "Allowed origins",
        owner: "security-guard",
        scope: "backend",
        recommended: env.STORE_CORS || null,
      }),
      valueSetting(env, "SECURITY_RATE_LIMIT_STORE", {
        label: "Rate limit store",
        owner: "security-guard",
        scope: "backend",
        recommended: "redis",
      }),
      secretSetting(env, "SECURITY_RATE_LIMIT_REDIS_URL", {
        label: "Rate limit Redis URL override",
        owner: "security-guard",
        scope: "backend",
        notes: "Falls back to REDIS_URL when unset.",
      }),
      boolSetting(env, "SECURITY_TRUST_PROXY_HEADERS", {
        label: "Trust proxy headers",
        owner: "security-guard",
        scope: "backend",
        recommended: true,
      }),
      boolSetting(env, "SECURITY_HSTS_INCLUDE_SUBDOMAINS", {
        label: "HSTS include subdomains",
        owner: "security-guard",
        scope: "backend",
        recommended: true,
      }),
      boolSetting(env, "SECURITY_HSTS_PRELOAD", {
        label: "HSTS preload",
        owner: "security-guard",
        scope: "backend",
        recommended: false,
        notes: "Enable only after all subdomains are HTTPS-ready.",
      }),
      valueSetting(env, "ACCOUNT_AUTH_RATE_LIMIT_MAX_REQUESTS", {
        label: "Account auth max requests",
        owner: "storefront-account",
        scope: "storefront",
        recommended: "20",
      }),
      valueSetting(env, "ACCOUNT_AUTH_RATE_LIMIT_WINDOW_SECONDS", {
        label: "Account auth window seconds",
        owner: "storefront-account",
        scope: "storefront",
        recommended: "600",
      }),
      boolSetting(env, "ACCOUNT_AUTH_TURNSTILE_ENABLED", {
        label: "Account Turnstile challenge",
        owner: "storefront-account",
        scope: "storefront",
        recommended: false,
      }),
      secretSetting(env, "TURNSTILE_SECRET_KEY", {
        label: "Turnstile secret key",
        owner: "storefront-account",
        scope: "storefront",
      }),
      boolSetting(env, "EXPECT_CLOUDFLARE", {
        label: "Expect Cloudflare edge",
        owner: "ops-control",
        scope: "cloudflare",
        recommended: true,
      }),
      valueSetting(env, "REQUIRE_CLOUDFLARE_SSL_MODE", {
        label: "Required Cloudflare SSL mode",
        owner: "ops-control",
        scope: "cloudflare",
        recommended: "strict",
      }),
      valueSetting(env, "CLOUDFLARE_ZONE_ID", {
        label: "Cloudflare zone id",
        owner: "ops-control",
        scope: "cloudflare",
        recommended: null,
      }),
      secretSetting(env, "CLOUDFLARE_API_TOKEN", {
        label: "Cloudflare settings-read API token",
        owner: "ops-control",
        scope: "cloudflare",
      }),
      boolSetting(env, "CLOUDFLARE_WAF_MANAGED_RULES_ENABLED", {
        label: "Cloudflare managed WAF rules",
        owner: "ops-control",
        scope: "cloudflare",
        recommended: true,
      }),
      boolSetting(env, "CLOUDFLARE_ACCESS_ADMIN_ENABLED", {
        label: "Cloudflare Access for admin",
        owner: "ops-control",
        scope: "cloudflare",
        recommended: true,
      }),
    ]
    const findings: OpsControlFinding[] = []

    if (normalized(env.SECURITY_RATE_LIMIT_STORE) !== "redis") {
      findings.push(finding({
        id: "security.rate-limit-store-not-redis",
        severity: "critical",
        owner: "security-guard",
        title: "Rate limiting is not backed by Redis",
        detail: "Production rate limits must survive process restarts and scale beyond one Node process.",
        recommended_action: "Set SECURITY_RATE_LIMIT_STORE=redis and provide REDIS_URL or SECURITY_RATE_LIMIT_REDIS_URL.",
        human_gate: false,
      }))
    }

    if (truthy(env.ACCOUNT_AUTH_TURNSTILE_ENABLED) && !configured(env.TURNSTILE_SECRET_KEY)) {
      findings.push(finding({
        id: "security.turnstile-secret-missing",
        severity: "critical",
        owner: "storefront-account",
        title: "Turnstile is enabled without a secret key",
        detail: "Login and registration challenges cannot be verified without TURNSTILE_SECRET_KEY.",
        recommended_action: "Set TURNSTILE_SECRET_KEY in the storefront runtime env or disable ACCOUNT_AUTH_TURNSTILE_ENABLED.",
        human_gate: true,
      }))
    }

    if (env.NODE_ENV === "production" && !truthy(env.EXPECT_CLOUDFLARE)) {
      findings.push(finding({
        id: "security.cloudflare-not-expected",
        severity: "warning",
        owner: "ops-control",
        title: "Cloudflare edge expectation is not enabled",
        detail: "The deploy edge preflight will not require Cloudflare headers unless EXPECT_CLOUDFLARE=true.",
        recommended_action: "Set EXPECT_CLOUDFLARE=true in deploy secrets and production ops env.",
        human_gate: true,
      }))
    }

    if (truthy(env.EXPECT_CLOUDFLARE) && normalized(env.REQUIRE_CLOUDFLARE_SSL_MODE || "strict") !== "strict") {
      findings.push(finding({
        id: "security.cloudflare-ssl-mode-not-strict",
        severity: "critical",
        owner: "ops-control",
        title: "Cloudflare SSL mode is not strict",
        detail: "Production should use Cloudflare Full (strict), never Flexible.",
        recommended_action: "Set REQUIRE_CLOUDFLARE_SSL_MODE=strict and configure the Cloudflare zone SSL/TLS mode to Full (strict).",
        human_gate: true,
      }))
    }

    if (!truthy(env.CLOUDFLARE_WAF_MANAGED_RULES_ENABLED)) {
      findings.push(finding({
        id: "security.cloudflare-waf-not-enabled",
        severity: "warning",
        owner: "ops-control",
        title: "Cloudflare managed WAF rules are not marked enabled",
        detail: "Managed WAF rules must be enabled and verified before production promotion.",
        recommended_action: "Enable Cloudflare managed WAF rules, run pnpm deploy:waf, and set CLOUDFLARE_WAF_MANAGED_RULES_ENABLED=true after verification.",
        human_gate: true,
      }))
    }

    if (!truthy(env.CLOUDFLARE_ACCESS_ADMIN_ENABLED)) {
      findings.push(finding({
        id: "security.admin-access-not-fronted",
        severity: "warning",
        owner: "ops-control",
        title: "Admin edge access protection is not marked enabled",
        detail: "Admin/API paths should have Cloudflare Access, IP allowlisting, or equivalent MFA-backed edge protection.",
        recommended_action: "Enable Cloudflare Access for admin paths and set CLOUDFLARE_ACCESS_ADMIN_ENABLED=true after verification.",
        human_gate: true,
      }))
    }

    return section({
      settings,
      findings,
      summary: {
        configured_settings: settings.filter((setting) => setting.configured).length,
        total_settings: settings.length,
        cloudflare_expected: truthy(env.EXPECT_CLOUDFLARE),
        turnstile_enabled: truthy(env.ACCOUNT_AUTH_TURNSTILE_ENABLED),
      },
    })
  }

  getMaintenanceSnapshot(input?: { env?: Env }): OpsControlSection {
    const env = input?.env || process.env
    const settings: OpsControlSetting[] = [
      valueSetting(env, "STOREFRONT_PUBLIC_URL", {
        label: "Public storefront URL",
        owner: "ops-control",
        scope: "deploy",
        recommended: null,
      }),
      valueSetting(env, "API_PUBLIC_URL", {
        label: "Public API URL",
        owner: "ops-control",
        scope: "deploy",
        recommended: null,
      }),
      valueSetting(env, "OPS_APP_ROOT", {
        label: "Application root",
        owner: "ops-control",
        scope: "vps",
        recommended: "/opt/store",
      }),
      valueSetting(env, "OPS_BACKUP_DIR", {
        label: "Backup directory",
        owner: "ops-control",
        scope: "vps",
        recommended: "/opt/store/shared/backups",
      }),
      boolSetting(env, "OPS_BACKUP_OFFSITE_ENABLED", {
        label: "Off-VPS backup copy",
        owner: "ops-control",
        scope: "vps",
        recommended: true,
      }),
      boolSetting(env, "OPS_BACKUP_ENCRYPTION_ENABLED", {
        label: "Encrypted backup artifacts",
        owner: "ops-control",
        scope: "vps",
        recommended: true,
      }),
      valueSetting(env, "OPS_BACKUP_LAST_RESTORE_TEST_AT", {
        label: "Last restore test timestamp",
        owner: "ops-control",
        scope: "vps",
        recommended: null,
      }),
      boolSetting(env, "OPS_AUDIT_RETENTION_ENABLED", {
        label: "Audit retention active",
        owner: "ops-control",
        scope: "vps",
        recommended: true,
      }),
      valueSetting(env, "AUDIT_LOG_RETENTION_DAYS", {
        label: "Audit retention days",
        owner: "support-audit",
        scope: "backend",
        recommended: "365",
      }),
      boolSetting(env, "OPS_VPS_DOCTOR_ENABLED", {
        label: "VPS doctor scheduled",
        owner: "ops-control",
        scope: "vps",
        recommended: true,
      }),
      boolSetting(env, "OPS_APP_USER_LEAST_PRIVILEGE", {
        label: "Least-privilege app user",
        owner: "ops-control",
        scope: "vps",
        recommended: true,
      }),
      valueSetting(env, "OPS_VPS_DOCTOR_LAST_REPORT_PATH", {
        label: "Last VPS doctor report path",
        owner: "ops-control",
        scope: "vps",
        recommended: "/opt/store/shared/logs/vps-doctor-latest.json",
      }),
      boolSetting(env, "OPS_SSH_ROOT_LOGIN_DISABLED", {
        label: "SSH root login disabled",
        owner: "ops-control",
        scope: "vps",
        recommended: true,
      }),
      boolSetting(env, "OPS_SSH_PASSWORD_AUTH_DISABLED", {
        label: "SSH password auth disabled",
        owner: "ops-control",
        scope: "vps",
        recommended: true,
      }),
      boolSetting(env, "OPS_UFW_ENABLED", {
        label: "Host firewall enabled",
        owner: "ops-control",
        scope: "vps",
        recommended: true,
      }),
      boolSetting(env, "OPS_UNATTENDED_UPGRADES_ENABLED", {
        label: "Automatic security updates",
        owner: "ops-control",
        scope: "vps",
        recommended: true,
      }),
      boolSetting(env, "OPS_DOCKER_SOCKET_EXPOSED", {
        label: "Docker socket exposed",
        owner: "ops-control",
        scope: "vps",
        recommended: false,
      }),
      valueSetting(env, "OPS_SYSTEMD_HARDENING_LEVEL", {
        label: "Systemd hardening level",
        owner: "ops-control",
        scope: "vps",
        recommended: "hardened",
      }),
    ]
    const findings: OpsControlFinding[] = []

    if (!configured(env.OPS_BACKUP_LAST_RESTORE_TEST_AT)) {
      findings.push(finding({
        id: "ops.restore-test-missing",
        severity: "warning",
        owner: "ops-control",
        title: "No restore test timestamp recorded",
        detail: "Backups are not production evidence until a restore has been tested on a separate target.",
        recommended_action: "Run a restore test and set OPS_BACKUP_LAST_RESTORE_TEST_AT to the verified UTC timestamp.",
        human_gate: true,
      }))
    }

    if (!truthy(env.OPS_BACKUP_OFFSITE_ENABLED)) {
      findings.push(finding({
        id: "ops.offsite-backup-not-enabled",
        severity: "critical",
        owner: "ops-control",
        title: "Off-VPS backup copy is not marked enabled",
        detail: "A VPS loss would also lose local database backups.",
        recommended_action: "Configure an offsite backup target and set OPS_BACKUP_OFFSITE_ENABLED=true after verifying copy and restore.",
        human_gate: true,
      }))
    }

    if (!truthy(env.OPS_BACKUP_ENCRYPTION_ENABLED)) {
      findings.push(finding({
        id: "ops.backup-encryption-not-enabled",
        severity: "critical",
        owner: "ops-control",
        title: "Backup encryption is not marked enabled",
        detail: "Database dumps can contain customer data and redeemable credentials; local and offsite artifacts must be encrypted.",
        recommended_action: "Set BACKUP_ENCRYPTION_KEY for backup jobs, verify .dump.enc output, and set OPS_BACKUP_ENCRYPTION_ENABLED=true.",
        human_gate: true,
      }))
    }

    if (!truthy(env.OPS_AUDIT_RETENTION_ENABLED)) {
      findings.push(finding({
        id: "ops.audit-retention-not-enabled",
        severity: "warning",
        owner: "support-audit",
        title: "Audit retention is not marked enabled",
        detail: "Audit logs need a defined retention window and scheduled pruning to avoid unbounded growth.",
        recommended_action: "Keep AUDIT_LOG_RETENTION_ENABLED=true, run the prune-audit-logs job, and set OPS_AUDIT_RETENTION_ENABLED=true.",
        human_gate: true,
      }))
    }

    if (!truthy(env.OPS_APP_USER_LEAST_PRIVILEGE)) {
      findings.push(finding({
        id: "ops.app-user-not-least-privilege",
        severity: "critical",
        owner: "ops-control",
        title: "Application user is not marked least privilege",
        detail: "The backend/storefront runtime user must not be root or have Docker socket access.",
        recommended_action: "Run pnpm deploy:vps-doctor, remove APP_USER from docker group, and set OPS_APP_USER_LEAST_PRIVILEGE=true after verification.",
        human_gate: true,
      }))
    }

    for (const [key, title] of [
      ["OPS_SSH_ROOT_LOGIN_DISABLED", "SSH root login is not marked disabled"],
      ["OPS_SSH_PASSWORD_AUTH_DISABLED", "SSH password auth is not marked disabled"],
      ["OPS_UFW_ENABLED", "Host firewall is not marked enabled"],
      ["OPS_UNATTENDED_UPGRADES_ENABLED", "Automatic security updates are not marked enabled"],
    ] as const) {
      if (!truthy(env[key])) {
        findings.push(finding({
          id: `ops.${key.toLowerCase()}`,
          severity: "warning",
          owner: "ops-control",
          title,
          detail: `${key} is not true in the ops control runtime snapshot.`,
          recommended_action: "Verify the VPS setting with machine evidence, then set the corresponding OPS_* flag.",
          human_gate: true,
        }))
      }
    }

    if (truthy(env.OPS_DOCKER_SOCKET_EXPOSED)) {
      findings.push(finding({
        id: "ops.docker-socket-exposed",
        severity: "critical",
        owner: "ops-control",
        title: "Docker socket is marked exposed",
        detail: "The Docker socket is root-equivalent and should not be reachable by web services or untrusted users.",
        recommended_action: "Remove Docker socket exposure and rerun VPS doctor.",
        human_gate: true,
      }))
    }

    return section({
      settings,
      findings,
      summary: {
        configured_settings: settings.filter((setting) => setting.configured).length,
        total_settings: settings.length,
        vps_doctor_enabled: truthy(env.OPS_VPS_DOCTOR_ENABLED),
      },
    })
  }

  getCommerceSnapshot(input?: { env?: Env }): OpsControlSection {
    return createCommerceSnapshot(input)
  }

  getCustomerSnapshot(input?: { env?: Env }): OpsControlSection {
    return createCustomerSnapshot(input)
  }

  getAiOpsSnapshot(input?: { env?: Env }): OpsControlSection {
    return createAiOpsSnapshot(input)
  }

}

export default OpsControlModuleService

function valueSetting(
  env: Env,
  key: string,
  input: Omit<OpsControlSetting, "key" | "configured" | "value" | "status" | "editable" | "secret"> & {
    secret?: boolean
  }
): OpsControlSetting {
  const isSecret = input.secret ?? SECRET_KEYS.has(key)
  const raw = env[key]
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
  env: Env,
  key: string,
  input: Omit<Parameters<typeof valueSetting>[2], "secret">
) {
  return valueSetting(env, key, {
    ...input,
    secret: true,
  })
}

function boolSetting(
  env: Env,
  key: string,
  input: Omit<OpsControlSetting, "key" | "configured" | "value" | "status" | "editable" | "secret"> & {
    recommended?: boolean
  }
): OpsControlSetting {
  const raw = env[key]
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
      ...input.findings.map((finding) =>
        finding.severity === "critical" ? "critical" : "warning"
      ),
      ...input.settings.map((setting) => setting.status),
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

function compareFindings(left: OpsControlFinding, right: OpsControlFinding) {
  const weight = {
    critical: 0,
    warning: 1,
    info: 2,
  }

  return weight[left.severity] - weight[right.severity] || left.id.localeCompare(right.id)
}
