import type {
  AIProviderConfigSafe,
  AIProviderStatus,
  AIRuntimeConfig,
} from "./types"
import {
  ENV_NAME_PATTERN,
  hasInlineSecret,
  isRecord,
  normalizeBaseUrl,
  normalizeCode,
  parseBoolean,
  readBoolean,
  readBooleanFromKeys,
  readNumber,
  readRecord,
  readStringArray,
  readText,
  sanitizeMetadata,
  text,
} from "../../utils/provider-config"

const DEFAULT_PROVIDER_KIND = "custom"
const DEFAULT_PROTOCOL = "custom-http"
const DEFAULT_TEXT_CAPABILITY = "text.generate"
const AI_INLINE_SECRET_ALLOWLIST = [
  "api_key_env",
  "apiKeyEnv",
  "key_env",
  "secret_env",
  // Legitimate non-secret config flags that nonetheless match the secret-key
  // heuristic and must not be treated as inline credentials.
  "requires_api_key",
  "requiresApiKey",
]

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
  const capabilities = normalizeCapabilities(
    readStringArray(source, ["capabilities", "capability_codes", "capabilityCodes"]),
    protocol
  )
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

  if (hasInlineSecret(source, AI_INLINE_SECRET_ALLOWLIST)) {
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
    capabilities,
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

function normalizeCapabilities(values: string[], protocol: string) {
  const capabilities = values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[a-z][a-z0-9_.:-]{1,80}$/.test(value))

  if (capabilities.length) {
    return Array.from(new Set(capabilities))
  }

  if (["chat-completions", "responses", "messages", "custom-http"].includes(protocol)) {
    return [DEFAULT_TEXT_CAPABILITY]
  }

  return []
}

