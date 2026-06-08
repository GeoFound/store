import type {
  AIProviderConfigSafe,
  AIProviderStatus,
  AIRuntimeConfig,
} from "./types"

const DEFAULT_PROVIDER_KIND = "custom"
const DEFAULT_PROTOCOL = "custom-http"
const SECRET_FIELD_PATTERN = /secret|token|password|credential|api[_-]?key|key/i
const ENV_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/
const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}$/

export function getAIRuntimeConfig(
  env: Record<string, string | undefined> = process.env
): AIRuntimeConfig {
  const issues: string[] = []
  const providers = parseProviderConfigs(env, issues)
  const configuredDefault = text(env.AI_DEFAULT_PROVIDER)
  const firstReadyProvider =
    providers.find((provider) => provider.enabled && provider.status === "configured") ||
    providers.find((provider) => provider.enabled)

  return {
    enabled: parseBoolean(env.AI_ENABLED, false),
    default_provider_code:
      configuredDefault || firstReadyProvider?.code || null,
    providers,
    issues,
  }
}

function parseProviderConfigs(
  env: Record<string, string | undefined>,
  runtimeIssues: string[]
) {
  const raw = text(env.AI_PROVIDER_CONFIGS_JSON)

  if (!raw) {
    return [] as AIProviderConfigSafe[]
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    runtimeIssues.push("AI_PROVIDER_CONFIGS_JSON is not valid JSON")
    return []
  }

  if (!Array.isArray(parsed)) {
    runtimeIssues.push("AI_PROVIDER_CONFIGS_JSON must be a JSON array")
    return []
  }

  return parsed.map((entry, index) => providerFromEntry(entry, index, env))
}

function providerFromEntry(
  entry: unknown,
  index: number,
  env: Record<string, string | undefined>
): AIProviderConfigSafe {
  const issues: string[] = []
  const source = isRecord(entry) ? entry : {}

  if (!isRecord(entry)) {
    issues.push("Provider config must be a JSON object")
  }

  const code = normalizeCode(
    readText(source, ["code", "id", "name"]) || `provider-${index + 1}`,
    issues
  )
  const label =
    readText(source, ["label", "display_name", "title"]) || code
  const providerKind =
    readText(source, ["provider_kind", "provider", "kind"]) ||
    DEFAULT_PROVIDER_KIND
  const protocol =
    readText(source, ["protocol", "api_protocol"]) || DEFAULT_PROTOCOL
  const baseUrl = normalizeBaseUrl(
    readText(source, ["base_url", "baseUrl", "endpoint_url", "endpoint"])
  )
  const defaultModel =
    readText(source, ["default_model", "defaultModel", "model"]) || null
  const apiKeyEnv =
    readText(source, ["api_key_env", "apiKeyEnv", "key_env", "secret_env"]) ||
    null
  const enabled = readBoolean(source, "enabled", true)
  const requiresApiKey = readBooleanFromKeys(
    source,
    ["requires_api_key", "requiresApiKey"],
    true
  )
  const siteIds = readStringArray(source, ["site_ids", "siteIds"])
  const priority = readNumber(source, "priority", 0)
  const metadata = sanitizeMetadata(readRecord(source, "metadata"))

  if (hasInlineSecret(source)) {
    issues.push(
      "Inline secret-like fields are ignored; use api_key_env to reference an environment variable"
    )
  }

  if (apiKeyEnv && !ENV_NAME_PATTERN.test(apiKeyEnv)) {
    issues.push("api_key_env must be an environment variable name")
  }

  const apiKeyConfigured = Boolean(apiKeyEnv && text(env[apiKeyEnv]))
  const status = resolveStatus({
    enabled,
    issues,
    apiKeyEnv,
    apiKeyConfigured,
    requiresApiKey,
  })

  return {
    code,
    label,
    provider_kind: providerKind,
    protocol,
    base_url: baseUrl,
    default_model: defaultModel,
    api_key_env: apiKeyEnv,
    api_key_configured: apiKeyConfigured,
    requires_api_key: requiresApiKey,
    enabled,
    site_ids: siteIds,
    priority,
    status,
    issues,
    metadata,
  }
}

function resolveStatus(input: {
  enabled: boolean
  issues: string[]
  apiKeyEnv: string | null
  apiKeyConfigured: boolean
  requiresApiKey: boolean
}): AIProviderStatus {
  if (!input.enabled) {
    return "disabled"
  }

  if (input.issues.length) {
    return "invalid"
  }

  if (input.requiresApiKey && !input.apiKeyEnv) {
    return "missing_key_ref"
  }

  if (input.requiresApiKey && !input.apiKeyConfigured) {
    return "missing_secret"
  }

  return "configured"
}

function normalizeCode(value: string, issues: string[]) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-")

  if (!CODE_PATTERN.test(normalized)) {
    issues.push("Provider code must use lowercase letters, numbers, underscore, or hyphen")
  }

  return normalized || "provider"
}

function normalizeBaseUrl(value: string) {
  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  return normalized.replace(/\/+$/, "")
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false
  }

  return fallback
}

function readBoolean(
  source: Record<string, unknown>,
  key: string,
  fallback: boolean
) {
  const value = source[key]

  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "string") {
    return parseBoolean(value, fallback)
  }

  return fallback
}

function readBooleanFromKeys(
  source: Record<string, unknown>,
  keys: string[],
  fallback: boolean
) {
  for (const key of keys) {
    if (source[key] !== undefined) {
      return readBoolean(source, key, fallback)
    }
  }

  return fallback
}

function readNumber(
  source: Record<string, unknown>,
  key: string,
  fallback: number
) {
  const value = source[key]
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN

  return Number.isFinite(parsed) ? parsed : fallback
}

function readText(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key]

    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return ""
}

function readStringArray(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key]

    if (Array.isArray(value)) {
      return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    }
  }

  return []
}

function readRecord(source: Record<string, unknown>, key: string) {
  const value = source[key]

  return isRecord(value) ? value : null
}

function sanitizeMetadata(value: Record<string, unknown> | null) {
  if (!value) {
    return null
  }

  return sanitizeRecord(value)
}

function sanitizeRecord(source: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      SECRET_FIELD_PATTERN.test(key) ? "[redacted]" : sanitizeValue(value),
    ])
  )
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry))
  }

  if (isRecord(value)) {
    return sanitizeRecord(value)
  }

  return value
}

function hasInlineSecret(source: Record<string, unknown>) {
  return Object.keys(source).some((key) => {
    if (["api_key_env", "apiKeyEnv", "key_env", "secret_env"].includes(key)) {
      return false
    }

    return SECRET_FIELD_PATTERN.test(key)
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function text(value: string | undefined) {
  return value?.trim() || ""
}
