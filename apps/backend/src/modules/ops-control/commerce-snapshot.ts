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

const PLISIO_API_BASE_URL = "https://api.plisio.net/api/v1"
const RELOADLY_AUTH_URL = "https://auth.reloadly.com/oauth/token"
const RELOADLY_GIFTCARDS_PRODUCTION_URL = "https://giftcards.reloadly.com"
const RELOADLY_GIFTCARDS_SANDBOX_URL = "https://giftcards-sandbox.reloadly.com"
const RELOADLY_AIRTIME_PRODUCTION_URL = "https://topups.reloadly.com"
const RELOADLY_AIRTIME_SANDBOX_URL = "https://topups-sandbox.reloadly.com"

export function createCommerceSnapshot(input?: { env?: Env }): OpsControlSection {
  const env = input?.env || process.env
  const production = env.NODE_ENV === "production"
  const storefrontPublicUrl = trimTrailingSlash(env.STOREFRONT_PUBLIC_URL || "")
  const plisioSuccessUrl = storefrontPublicUrl
    ? `${storefrontPublicUrl}/checkout?payment=success`
    : null
  const plisioFailUrl = storefrontPublicUrl
    ? `${storefrontPublicUrl}/checkout?payment=failed`
    : null
  const reloadlyGiftcardsBaseUrl = production
    ? RELOADLY_GIFTCARDS_PRODUCTION_URL
    : RELOADLY_GIFTCARDS_SANDBOX_URL
  const reloadlyAirtimeBaseUrl = production
    ? RELOADLY_AIRTIME_PRODUCTION_URL
    : RELOADLY_AIRTIME_SANDBOX_URL
  const outOfStockPolicy = normalized(env.CHECKOUT_OUT_OF_STOCK_POLICY || "block")
  const allowsSupplierBackorder = ["allow_supplier_backorder", "supplier_backorder", "allow"].includes(outOfStockPolicy)
  const validOutOfStockPolicy = ["", "block", "allow_supplier_backorder", "supplier_backorder", "allow"].includes(outOfStockPolicy)
  const supplierAutoProcurementEnabled = truthy(
    env.SUPPLIER_AUTO_PROCUREMENT_ENABLED
  )

  const settings: OpsControlSetting[] = [
    secretSetting("PLISIO_API_KEY", env.PLISIO_API_KEY, {
      label: "Plisio API key",
      owner: "payment-router",
      scope: "payment",
    }),
    valueSetting("PLISIO_CALLBACK_BASE_URL", env.PLISIO_CALLBACK_BASE_URL, {
      label: "Plisio callback base URL",
      owner: "payment-router",
      scope: "payment",
      recommended: env.API_PUBLIC_URL || null,
      fallbackConfigured: configured(env.API_PUBLIC_URL),
      notes: "Builds /hooks/payment/plisio?json=true for signed callbacks.",
    }),
    valueSetting("PLISIO_API_BASE_URL", env.PLISIO_API_BASE_URL, {
      label: "Plisio API base URL",
      owner: "payment-router",
      scope: "payment",
      recommended: PLISIO_API_BASE_URL,
      optional: true,
      notes: "Uses the Plisio API default when unset.",
    }),
    valueSetting("PLISIO_SUCCESS_URL", env.PLISIO_SUCCESS_URL, {
      label: "Plisio success URL",
      owner: "payment-router",
      scope: "payment",
      recommended: plisioSuccessUrl,
      fallbackConfigured: configured(plisioSuccessUrl),
      optional: true,
    }),
    valueSetting("PLISIO_FAIL_URL", env.PLISIO_FAIL_URL, {
      label: "Plisio fail URL",
      owner: "payment-router",
      scope: "payment",
      recommended: plisioFailUrl,
      fallbackConfigured: configured(plisioFailUrl),
      optional: true,
    }),
    valueSetting("PLISIO_DEFAULT_CRYPTO_CURRENCY", env.PLISIO_DEFAULT_CRYPTO_CURRENCY, {
      label: "Plisio default crypto currency",
      owner: "payment-router",
      scope: "payment",
      recommended: null,
      optional: true,
      notes: "Optional; leave empty to let Plisio use active shop currencies.",
    }),
    valueSetting("PLISIO_ALLOWED_PSYS_CIDS", env.PLISIO_ALLOWED_PSYS_CIDS, {
      label: "Plisio allowed crypto currencies",
      owner: "payment-router",
      scope: "payment",
      recommended: null,
      optional: true,
      notes: "Optional comma-separated allow-list such as BTC,ETH,USDT.",
    }),
    valueSetting("PLISIO_EXPIRE_MINUTES", env.PLISIO_EXPIRE_MINUTES, {
      label: "Plisio invoice expiry minutes",
      owner: "payment-router",
      scope: "payment",
      recommended: "60",
      optional: true,
      notes: "Uses a provider-side/default timeout when unset.",
    }),
    secretSetting("MANUAL_WEBHOOK_SECRET", env.MANUAL_WEBHOOK_SECRET, {
      label: "Manual webhook secret",
      owner: "payment-router",
      scope: "payment",
      optional: true,
      notes: "Manual payment channel is disabled by default for public checkout.",
    }),
    valueSetting(
      "MANUAL_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS",
      env.MANUAL_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
      {
        label: "Manual webhook signature tolerance",
        owner: "payment-router",
        scope: "payment",
        recommended: "300",
        optional: true,
      }
    ),
    valueSetting(
      "CHECKOUT_OUT_OF_STOCK_POLICY",
      env.CHECKOUT_OUT_OF_STOCK_POLICY,
      {
        label: "Out-of-stock checkout policy",
        owner: "payment-router",
        scope: "payment",
        recommended: "block",
        optional: true,
        notes: "Set allow_supplier_backorder only for variants with a supplier path.",
      }
    ),
    valueSetting("RELOADLY_ENV", env.RELOADLY_ENV, {
      label: "Reloadly environment",
      owner: "supplier-reloadly",
      scope: "supplier",
      recommended: production ? "production" : "sandbox",
      optional: !production,
    }),
    secretSetting("RELOADLY_CLIENT_ID", env.RELOADLY_CLIENT_ID, {
      label: "Reloadly client id",
      owner: "supplier-reloadly",
      scope: "supplier",
    }),
    secretSetting("RELOADLY_CLIENT_SECRET", env.RELOADLY_CLIENT_SECRET, {
      label: "Reloadly client secret",
      owner: "supplier-reloadly",
      scope: "supplier",
    }),
    valueSetting("RELOADLY_AUTH_URL", env.RELOADLY_AUTH_URL, {
      label: "Reloadly auth URL",
      owner: "supplier-reloadly",
      scope: "supplier",
      recommended: RELOADLY_AUTH_URL,
      optional: true,
      notes: "Uses the Reloadly OAuth default when unset.",
    }),
    valueSetting("RELOADLY_AUDIENCE", env.RELOADLY_AUDIENCE, {
      label: "Reloadly audience",
      owner: "supplier-reloadly",
      scope: "supplier",
      recommended: null,
      optional: true,
      notes: "Optional; defaults to the selected gift-card API base URL.",
    }),
    valueSetting("RELOADLY_API_BASE_URL", env.RELOADLY_API_BASE_URL, {
      label: "Reloadly legacy gift-card base URL",
      owner: "supplier-reloadly",
      scope: "supplier",
      recommended: null,
      optional: true,
      notes: "Compatibility alias used only when RELOADLY_GIFTCARDS_BASE_URL is unset.",
    }),
    valueSetting("RELOADLY_GIFTCARDS_BASE_URL", env.RELOADLY_GIFTCARDS_BASE_URL, {
      label: "Reloadly gift-card base URL",
      owner: "supplier-reloadly",
      scope: "supplier",
      recommended: reloadlyGiftcardsBaseUrl,
      optional: true,
      notes: "Uses the Reloadly environment default when unset.",
    }),
    valueSetting("RELOADLY_AIRTIME_BASE_URL", env.RELOADLY_AIRTIME_BASE_URL, {
      label: "Reloadly airtime base URL",
      owner: "supplier-reloadly",
      scope: "supplier",
      recommended: reloadlyAirtimeBaseUrl,
      optional: true,
      notes: "Uses the Reloadly environment default when unset.",
    }),
    valueSetting("RELOADLY_SENDER_NAME", env.RELOADLY_SENDER_NAME, {
      label: "Reloadly sender name",
      owner: "supplier-reloadly",
      scope: "supplier",
      recommended: "Store",
      optional: true,
    }),
    secretSetting("SUPPLIER_ENCRYPTION_KEY", env.SUPPLIER_ENCRYPTION_KEY, {
      label: "Supplier payload encryption key",
      owner: "supplier-procurement",
      scope: "supplier",
      optional: !production,
    }),
    valueSetting(
      "SUPPLIER_PROCUREMENT_RETRY_BATCH_SIZE",
      env.SUPPLIER_PROCUREMENT_RETRY_BATCH_SIZE,
      {
        label: "Supplier retry batch size",
        owner: "supplier-procurement",
        scope: "supplier",
        recommended: "25",
        optional: true,
      }
    ),
    valueSetting(
      "SUPPLIER_AUTO_PROCUREMENT_ENABLED",
      env.SUPPLIER_AUTO_PROCUREMENT_ENABLED,
      {
        label: "Supplier auto procurement",
        owner: "supplier-procurement",
        scope: "supplier",
        recommended: "false",
        optional: true,
        notes: "When false, supplier-backed orders enter needs_review for manual handling.",
      }
    ),
  ]
  const findings: OpsControlFinding[] = []

  if (!validOutOfStockPolicy) {
    findings.push(finding({
      id: "commerce.out-of-stock-policy-invalid",
      severity: "critical",
      owner: "payment-router",
      title: "Out-of-stock checkout policy is invalid",
      detail:
        "CHECKOUT_OUT_OF_STOCK_POLICY must be block or allow_supplier_backorder.",
      recommended_action:
        "Set CHECKOUT_OUT_OF_STOCK_POLICY=block unless supplier backorder handling is proven.",
      human_gate: true,
    }))
  }

  if (allowsSupplierBackorder && production) {
    findings.push(finding({
      id: "commerce.out-of-stock-supplier-backorder-enabled",
      severity: "warning",
      owner: "supplier-procurement",
      title: "Out-of-stock supplier backorder is enabled",
      detail:
        "Customers can pay for variants with no local credential inventory when a supplier path exists.",
      recommended_action:
        "Verify supplier mapping, pending-order review, and provider smoke evidence before keeping this enabled.",
      human_gate: true,
    }))
  }

  if (!configured(env.PLISIO_API_KEY)) {
    findings.push(finding({
      id: "commerce.plisio-api-key-missing",
      severity: production ? "critical" : "warning",
      owner: "payment-router",
      title: "Plisio API key is missing",
      detail: "Crypto checkout cannot create Plisio invoices without PLISIO_API_KEY.",
      recommended_action:
        "Set PLISIO_API_KEY in backend runtime env, then create a provider sandbox/live invoice smoke.",
      human_gate: true,
    }))
  }

  if (!configured(env.PLISIO_CALLBACK_BASE_URL) && !configured(env.API_PUBLIC_URL)) {
    findings.push(finding({
      id: "commerce.plisio-callback-base-url-missing",
      severity: production ? "critical" : "warning",
      owner: "payment-router",
      title: "Plisio callback public URL is missing",
      detail: "Plisio needs a public backend URL for /hooks/payment/plisio?json=true callbacks.",
      recommended_action:
        "Set PLISIO_CALLBACK_BASE_URL or API_PUBLIC_URL to the HTTPS backend origin and verify webhook delivery.",
      human_gate: true,
    }))
  }

  if (!configured(env.RELOADLY_CLIENT_ID) || !configured(env.RELOADLY_CLIENT_SECRET)) {
    findings.push(finding({
      id: "commerce.reloadly-credentials-missing",
      severity: supplierAutoProcurementEnabled ? "critical" : "warning",
      owner: "supplier-reloadly",
      title: "Reloadly credentials are missing",
      detail: "Reloadly-first supplier procurement cannot run live provider smoke without client credentials.",
      recommended_action:
        "Set RELOADLY_CLIENT_ID and RELOADLY_CLIENT_SECRET, then run Reloadly sandbox smoke before enabling automatic procurement.",
      human_gate: true,
    }))
  }

  if (supplierAutoProcurementEnabled) {
    findings.push(finding({
      id: "commerce.supplier-auto-procurement-enabled",
      severity: production ? "critical" : "warning",
      owner: "supplier-procurement",
      title: "Supplier auto procurement is enabled",
      detail:
        "Provider calls can spend supplier balance and deliver redeemable goods automatically.",
      recommended_action:
        "Keep SUPPLIER_AUTO_PROCUREMENT_ENABLED=false until sandbox and live provider smoke evidence is recorded.",
      human_gate: true,
    }))
  }

  if (production && normalized(env.RELOADLY_ENV || "sandbox") !== "production") {
    findings.push(finding({
      id: "commerce.reloadly-env-not-production",
      severity: "warning",
      owner: "supplier-reloadly",
      title: "Reloadly environment is not production",
      detail: "Production supplier smoke should use Reloadly production after sandbox proof is recorded.",
      recommended_action:
        "Keep sandbox until evidence exists; switch RELOADLY_ENV=production only for the final live provider smoke.",
      human_gate: true,
    }))
  }

  if (!configured(env.SUPPLIER_ENCRYPTION_KEY) && production) {
    findings.push(finding({
      id: "commerce.supplier-encryption-key-missing",
      severity: "critical",
      owner: "supplier-procurement",
      title: "Supplier encryption key is missing",
      detail:
        "Supplier fulfillment payloads can include redeemable values and must be encrypted with a dedicated key.",
      recommended_action:
        "Set SUPPLIER_ENCRYPTION_KEY to a 32-byte base64 key before enabling supplier procurement.",
      human_gate: true,
    }))
  }

  return section({
    settings,
    findings,
    summary: {
      configured_settings: settings.filter((setting) => setting.configured).length,
      total_settings: settings.length,
      plisio_ready:
        configured(env.PLISIO_API_KEY) &&
        (configured(env.PLISIO_CALLBACK_BASE_URL) || configured(env.API_PUBLIC_URL)),
      reloadly_ready:
        configured(env.RELOADLY_CLIENT_ID) && configured(env.RELOADLY_CLIENT_SECRET),
      supplier_encryption_ready: !production || configured(env.SUPPLIER_ENCRYPTION_KEY),
      out_of_stock_policy: validOutOfStockPolicy
        ? (allowsSupplierBackorder ? "allow_supplier_backorder" : "block")
        : "invalid",
      supplier_auto_procurement_enabled: supplierAutoProcurementEnabled,
    },
  })
}

function valueSetting(
  key: string,
  raw: string | undefined,
  input: SettingInput
): OpsControlSetting {
  const isConfigured = configured(raw)
  const status = settingStatus(raw, input)

  return {
    key,
    label: input.label,
    owner: input.owner,
    scope: input.scope,
    configured: isConfigured,
    secret: input.secret ?? false,
    value: input.secret ? null : raw || null,
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

function truthy(value: unknown) {
  return ["1", "true", "yes", "on"].includes(normalized(value))
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
