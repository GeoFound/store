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
  fallbackConfigured?: boolean
  optional?: boolean
  secret?: boolean
}

const ACCOUNT_MODES = ["", "guest_optional", "optional", "guest_only", "disabled", "off"]
const EMAIL_VERIFICATION_STRATEGIES = ["", "recovery_only", "disabled"]

export function createCustomerSnapshot(input?: { env?: Env }): OpsControlSection {
  const env = input?.env || process.env
  const production = env.NODE_ENV === "production"
  const accountMode = normalized(env.CUSTOMER_ACCOUNT_MODE || "guest_optional")
  const customerAccountsEnabled = !["guest_only", "disabled", "off"].includes(accountMode)
  const validAccountMode = ACCOUNT_MODES.includes(accountMode)
  const passwordResetEnabled =
    customerAccountsEnabled && !["0", "false", "no", "off"].includes(
      normalized(env.CUSTOMER_PASSWORD_RESET_ENABLED)
    )
  const storefrontPublicUrl = trimTrailingSlash(env.STOREFRONT_PUBLIC_URL || "")
  const recommendedResetUrl = storefrontPublicUrl
    ? `${storefrontPublicUrl}/account/reset-password`
    : null
  const emailVerificationStrategy = normalized(
    env.CUSTOMER_EMAIL_VERIFICATION_STRATEGY || "recovery_only"
  )
  const validEmailVerificationStrategy =
    EMAIL_VERIFICATION_STRATEGIES.includes(emailVerificationStrategy)
  const googleValues = [
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_CALLBACK_URL,
  ]
  const googlePartiallyConfigured =
    googleValues.some(configured) && !googleValues.every(configured)

  const settings: OpsControlSetting[] = [
    valueSetting("CUSTOMER_ACCOUNT_MODE", env.CUSTOMER_ACCOUNT_MODE, {
      label: "Customer account mode",
      owner: "customer-account",
      scope: "customer",
      recommended: "guest_optional",
      optional: true,
      notes: "guest_optional keeps checkout guest-first; guest_only disables customer sign-in and registration.",
    }),
    valueSetting(
      "CUSTOMER_PASSWORD_RESET_ENABLED",
      env.CUSTOMER_PASSWORD_RESET_ENABLED,
      {
        label: "Customer password reset",
        owner: "customer-account",
        scope: "customer",
        recommended: "true",
        optional: true,
      }
    ),
    valueSetting("CUSTOMER_PASSWORD_RESET_URL", env.CUSTOMER_PASSWORD_RESET_URL, {
      label: "Customer password reset URL",
      owner: "customer-account",
      scope: "customer",
      recommended: recommendedResetUrl,
      fallbackConfigured: configured(recommendedResetUrl),
      optional: true,
      notes: "Storefront BFF also sends this URL in reset-password metadata.",
    }),
    valueSetting(
      "CUSTOMER_EMAIL_VERIFICATION_STRATEGY",
      env.CUSTOMER_EMAIL_VERIFICATION_STRATEGY,
      {
        label: "Customer email verification strategy",
        owner: "customer-account",
        scope: "customer",
        recommended: "recovery_only",
        optional: true,
        notes: "Lightweight mode verifies email through order recovery and reset links, not a heavy membership gate.",
      }
    ),
    valueSetting("GOOGLE_CALLBACK_URL", env.GOOGLE_CALLBACK_URL, {
      label: "Google callback URL",
      owner: "customer-account",
      scope: "customer",
      recommended: recommendedGoogleCallbackUrl(storefrontPublicUrl),
      optional: true,
    }),
    valueSetting("GOOGLE_CLIENT_ID", env.GOOGLE_CLIENT_ID, {
      label: "Google client id",
      owner: "customer-account",
      scope: "customer",
      recommended: null,
      optional: true,
    }),
    secretSetting("GOOGLE_CLIENT_SECRET", env.GOOGLE_CLIENT_SECRET, {
      label: "Google client secret",
      owner: "customer-account",
      scope: "customer",
      optional: true,
    }),
  ]
  const findings: OpsControlFinding[] = []

  if (!validAccountMode) {
    findings.push(finding({
      id: "customer.account-mode-invalid",
      severity: "critical",
      owner: "customer-account",
      title: "Customer account mode is invalid",
      detail: "CUSTOMER_ACCOUNT_MODE must be guest_optional or guest_only.",
      recommended_action: "Set CUSTOMER_ACCOUNT_MODE=guest_optional for the lightweight account model.",
      human_gate: false,
    }))
  }

  if (!validEmailVerificationStrategy) {
    findings.push(finding({
      id: "customer.email-verification-strategy-invalid",
      severity: "critical",
      owner: "customer-account",
      title: "Customer email verification strategy is invalid",
      detail: "CUSTOMER_EMAIL_VERIFICATION_STRATEGY must be recovery_only or disabled.",
      recommended_action: "Set CUSTOMER_EMAIL_VERIFICATION_STRATEGY=recovery_only.",
      human_gate: false,
    }))
  }

  if (customerAccountsEnabled && !passwordResetEnabled) {
    findings.push(finding({
      id: "customer.password-reset-disabled",
      severity: "warning",
      owner: "customer-account",
      title: "Password reset is disabled while password login is available",
      detail: "Customers can create password accounts but cannot self-serve a forgotten password.",
      recommended_action: "Set CUSTOMER_PASSWORD_RESET_ENABLED=true or set CUSTOMER_ACCOUNT_MODE=guest_only.",
      human_gate: true,
    }))
  }

  if (passwordResetEnabled && production && !configured(env.CUSTOMER_PASSWORD_RESET_URL) && !configured(env.STOREFRONT_PUBLIC_URL)) {
    findings.push(finding({
      id: "customer.password-reset-url-missing",
      severity: "warning",
      owner: "customer-account",
      title: "Password reset URL is not explicitly configured",
      detail: "Production reset emails should use a stable HTTPS storefront URL.",
      recommended_action: "Set CUSTOMER_PASSWORD_RESET_URL or STOREFRONT_PUBLIC_URL to the production storefront origin.",
      human_gate: true,
    }))
  }

  if (production && emailVerificationStrategy === "disabled") {
    findings.push(finding({
      id: "customer.email-verification-disabled",
      severity: "warning",
      owner: "customer-account",
      title: "Customer email verification strategy is disabled",
      detail: "Order recovery and password reset rely on email possession as the lightweight verification boundary.",
      recommended_action: "Use CUSTOMER_EMAIL_VERIFICATION_STRATEGY=recovery_only unless you intentionally accept weaker account recovery.",
      human_gate: true,
    }))
  }

  if (googlePartiallyConfigured) {
    findings.push(finding({
      id: "customer.google-auth-partial-config",
      severity: "critical",
      owner: "customer-account",
      title: "Google customer auth is partially configured",
      detail: "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL must be configured together.",
      recommended_action: "Set all three Google auth values, or leave all three empty to keep Google login disabled.",
      human_gate: true,
    }))
  }

  return section({
    settings,
    findings,
    summary: {
      configured_settings: settings.filter((setting) => setting.configured).length,
      total_settings: settings.length,
      customer_account_mode: validAccountMode
        ? customerAccountsEnabled
          ? "guest_optional"
          : "guest_only"
        : "invalid",
      password_reset_enabled: passwordResetEnabled,
      email_verification_strategy: validEmailVerificationStrategy
        ? emailVerificationStrategy || "recovery_only"
        : "invalid",
      google_auth_enabled: googleValues.every(configured),
    },
  })
}

function valueSetting(
  key: string,
  raw: string | undefined,
  input: SettingInput
): OpsControlSetting {
  const isConfigured = configured(raw)

  return {
    key,
    label: input.label,
    owner: input.owner,
    scope: input.scope,
    configured: isConfigured,
    secret: input.secret ?? false,
    value: input.secret ? null : raw || null,
    recommended: input.recommended,
    status: settingStatus(raw, input),
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

function settingStatus(
  raw: string | undefined,
  input: SettingInput
): OpsControlStatus {
  if (!configured(raw)) {
    return input.optional || input.fallbackConfigured ? "ok" : "warning"
  }

  if (typeof input.recommended === "undefined" || input.recommended === null) {
    return "ok"
  }

  return rawMatches(raw, input.recommended) ? "ok" : "warning"
}

function section(input: {
  settings: OpsControlSetting[]
  findings: OpsControlFinding[]
  summary: Record<string, unknown>
}): OpsControlSection {
  return {
    status: summarizeStatus([
      ...input.findings.map((item) =>
        item.severity === "critical" ? "critical" : "warning"
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

function rawMatches(value: unknown, recommended: string | boolean | number | null) {
  if (recommended === null) {
    return configured(value)
  }

  if (typeof recommended === "boolean") {
    return ["1", "true", "yes", "on"].includes(normalized(value)) === recommended
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

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}

function recommendedGoogleCallbackUrl(storefrontPublicUrl: string) {
  return storefrontPublicUrl
    ? `${storefrontPublicUrl}/api/account/google/callback`
    : null
}
