import { MedusaError } from "@medusajs/framework/utils"
import { getAIRuntimeConfig } from "./config"
import type { AIProviderConfigSafe } from "./types"
import type {
  AIMessage,
  AIProvider,
  AIProviderConfigSnapshot,
} from "../../platform/ai"

type Fetcher = (
  input: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
  }
) => Promise<{
  ok: boolean
  status: number
  statusText: string
  headers: {
    get(name: string): string | null
  }
  json(): Promise<unknown>
  text(): Promise<string>
}>

export type AIInvokeForCapabilityInput = {
  capability: string
  providerCode?: string | null
  siteId?: string | null
  model?: string | null
  messages?: AIMessage[]
  prompt?: string | null
  input?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  env?: Record<string, string | undefined>
  fetcher?: Fetcher
  /**
   * Optional lookup for a registered {@link AIProvider} contract by code. When
   * it returns a provider that implements `invoke`, that implementation is used
   * instead of the config-driven HTTP path — this is how plugin-supplied
   * providers (relays, local models) override the default transport.
   */
  resolveRegisteredProvider?: (code: string) => AIProvider | null | undefined
}

export type AIInvokeForCapabilityResult = {
  provider_code: string
  provider_protocol: string
  provider_capabilities: string[]
  capability: string
  model: string | null
  output_text: string | null
  output: Record<string, unknown> | null
  raw: Record<string, unknown> | null
  usage: Record<string, unknown> | null
}

export async function invokeAIForCapability(
  input: AIInvokeForCapabilityInput
): Promise<AIInvokeForCapabilityResult> {
  const env = input.env || process.env
  const config = getAIRuntimeConfig(env)
  const capability = normalizeCapability(input.capability)

  if (!config.enabled) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "AI runtime is disabled")
  }

  const provider = selectProvider({
    providers: config.providers,
    providerCode: input.providerCode || config.default_provider_code,
    capability,
    siteId: input.siteId,
  })

  if (!provider) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `No configured AI provider supports ${capability}`
    )
  }

  const model = text(input.model || undefined) || provider.default_model
  const registeredProvider = input.resolveRegisteredProvider?.(provider.code)

  if (registeredProvider?.invoke) {
    return invokeViaRegisteredProvider({
      provider: registeredProvider,
      config: provider,
      capability,
      model,
      messages: input.messages,
      prompt: input.prompt,
      input: input.input,
      metadata: input.metadata,
    })
  }

  const request = buildProviderRequest({
    provider,
    capability,
    apiKey: provider.api_key_env ? text(env[provider.api_key_env]) : "",
    model,
    messages: input.messages,
    prompt: input.prompt,
    input: input.input,
    metadata: input.metadata,
  })
  const fetcher = input.fetcher || (globalThis.fetch as unknown as Fetcher)
  const response = await fetcher(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
  })

  if (!response.ok) {
    const body = (await response.text()).slice(0, 1000)
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `AI provider ${provider.code} failed with ${response.status}: ${body || response.statusText}`
    )
  }

  const contentType = response.headers.get("content-type") || ""
  const raw =
    (contentType.includes("json")
      ? toRecord(await response.json())
      : { text: await response.text() }) || {}
  const outputText = extractOutputText(raw)

  return {
    provider_code: provider.code,
    provider_protocol: provider.protocol,
    provider_capabilities: provider.capabilities,
    capability,
    model: request.model,
    output_text: outputText,
    output: extractOutput(raw, outputText),
    raw,
    usage: toRecord(raw.usage),
  }
}

async function invokeViaRegisteredProvider(input: {
  provider: AIProvider
  config: AIProviderConfigSafe
  capability: string
  model: string | null
  messages?: AIMessage[]
  prompt?: string | null
  input?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}): Promise<AIInvokeForCapabilityResult> {
  const snapshot: AIProviderConfigSnapshot = {
    code: input.config.code,
    label: input.config.label,
    providerKind: input.config.provider_kind,
    protocol: input.config.protocol,
    baseUrl: input.config.base_url,
    defaultModel: input.config.default_model,
    capabilities: input.config.capabilities,
    apiKeyEnv: input.config.api_key_env,
    siteIds: input.config.site_ids,
    metadata: input.config.metadata,
  }
  const result = await input.provider.invoke!({
    providerConfig: snapshot,
    model: input.model,
    messages: input.messages,
    prompt: input.prompt || undefined,
    input: input.input,
    metadata: input.metadata,
  })
  const raw = result.raw || {}
  const outputText = result.outputText?.trim() || extractOutputText(raw)

  return {
    provider_code: input.config.code,
    provider_protocol: input.config.protocol,
    provider_capabilities: input.config.capabilities,
    capability: input.capability,
    model: input.model,
    output_text: outputText,
    output: result.output || extractOutput(raw, outputText),
    raw: result.raw || null,
    usage: result.usage || null,
  }
}

function selectProvider(input: {
  providers: AIProviderConfigSafe[]
  providerCode?: string | null
  capability: string
  siteId?: string | null
}) {
  const candidates = input.providers
    .filter((provider) => provider.enabled && provider.status === "configured")
    .filter((provider) => supportsSite(provider, input.siteId))
    .filter((provider) => provider.capabilities.includes(input.capability))

  if (input.providerCode) {
    return candidates.find((provider) => provider.code === input.providerCode) || null
  }

  return candidates.sort((left, right) => right.priority - left.priority)[0] || null
}

function buildProviderRequest(input: {
  provider: AIProviderConfigSafe
  capability: string
  apiKey: string
  model: string | null
  messages?: AIMessage[]
  prompt?: string | null
  input?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}) {
  const protocol = input.provider.protocol.toLowerCase()
  const url = buildEndpoint(input.provider, protocol)
  const headers = buildHeaders(input.provider, input.apiKey)
  const body = buildBody({
    protocol,
    capability: input.capability,
    model: input.model,
    messages: input.messages,
    prompt: input.prompt,
    input: input.input,
    metadata: input.metadata,
  })

  return {
    url,
    headers,
    body,
    model: input.model,
  }
}

function buildEndpoint(provider: AIProviderConfigSafe, protocol: string) {
  const metadata = provider.metadata || {}
  const explicitUrl = readText(metadata, ["invoke_url", "url"])
  const baseUrl = explicitUrl || provider.base_url

  if (!baseUrl) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `AI provider ${provider.code} is missing base_url`
    )
  }

  const requestPath = readText(metadata, ["request_path", "invoke_path", "path"])

  if (requestPath) {
    return joinUrl(baseUrl, requestPath)
  }

  if (["chat-completions", "openai-chat-completions", "openai-compatible"].includes(protocol)) {
    return joinUrl(baseUrl, "/chat/completions")
  }

  if (["responses", "openai-responses"].includes(protocol)) {
    return joinUrl(baseUrl, "/responses")
  }

  if (["messages", "anthropic-messages"].includes(protocol)) {
    return joinUrl(baseUrl, "/messages")
  }

  return baseUrl
}

function buildHeaders(provider: AIProviderConfigSafe, apiKey: string) {
  const metadata = provider.metadata || {}
  const headers: Record<string, string> = {
    "content-type": "application/json",
  }
  const extraHeaders = toRecord(metadata.extra_headers)

  for (const [key, value] of Object.entries(extraHeaders || {})) {
    if (typeof value === "string" && /^[a-z0-9-]+$/i.test(key)) {
      headers[key] = value
    }
  }

  if (!apiKey) {
    return headers
  }

  const authHeader = readText(metadata, ["auth_header"]) || "authorization"
  const authScheme = readText(metadata, ["auth_scheme"]).toLowerCase() || "bearer"

  if (authScheme === "none") {
    return headers
  }

  headers[authHeader] = authScheme === "raw" ? apiKey : `${authScheme === "api-key" ? "" : "Bearer "}${apiKey}`

  return headers
}

function buildBody(input: {
  protocol: string
  capability: string
  model: string | null
  messages?: AIMessage[]
  prompt?: string | null
  input?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}) {
  const extraInput = input.input || {}
  const messages =
    input.messages && input.messages.length
      ? input.messages
      : input.prompt
        ? [{ role: "user", content: input.prompt }]
        : []

  if (["chat-completions", "openai-chat-completions", "openai-compatible"].includes(input.protocol)) {
    return {
      ...extraInput,
      model: input.model,
      messages,
    }
  }

  if (["responses", "openai-responses"].includes(input.protocol)) {
    return {
      ...extraInput,
      model: input.model,
      input: input.prompt || messagesToText(messages),
    }
  }

  if (["messages", "anthropic-messages"].includes(input.protocol)) {
    return {
      max_tokens: 2048,
      ...extraInput,
      model: input.model,
      messages: messages.filter((message) => message.role !== "system"),
      system: messages.find((message) => message.role === "system")?.content,
    }
  }

  return {
    ...extraInput,
    capability: input.capability,
    model: input.model,
    prompt: input.prompt,
    messages,
    metadata: input.metadata || null,
  }
}

function extractOutput(raw: Record<string, unknown>, outputText: string | null) {
  const explicitOutput = toRecord(raw.output)

  if (explicitOutput) {
    return explicitOutput
  }

  if (outputText) {
    return {
      text: outputText,
    }
  }

  return raw
}

function extractOutputText(raw: Record<string, unknown>): string | null {
  for (const key of ["output_text", "outputText", "text", "content"]) {
    const value = raw[key]

    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  const choices = Array.isArray(raw.choices) ? raw.choices : []
  const firstChoice = toRecord(choices[0])
  const message = toRecord(firstChoice?.message)
  const messageContent = message?.content

  if (typeof messageContent === "string" && messageContent.trim()) {
    return messageContent.trim()
  }

  const output = Array.isArray(raw.output) ? raw.output : []
  const outputContent = output
    .flatMap((item) => {
      const record = toRecord(item)
      return Array.isArray(record?.content) ? record.content : []
    })
    .map((item) => toRecord(item)?.text)
    .find((value) => typeof value === "string" && value.trim())

  return typeof outputContent === "string" ? outputContent.trim() : null
}

function supportsSite(provider: AIProviderConfigSafe, siteId?: string | null) {
  return (
    !siteId ||
    provider.site_ids.length === 0 ||
    provider.site_ids.includes(siteId)
  )
}

function normalizeCapability(value: string) {
  const capability = value.trim().toLowerCase()

  if (!/^[a-z][a-z0-9_.:-]{1,80}$/.test(capability)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid AI capability")
  }

  return capability
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`
}

function messagesToText(messages: AIMessage[]) {
  return messages
    .map((message) =>
      typeof message.content === "string"
        ? `${message.role}: ${message.content}`
        : `${message.role}: ${JSON.stringify(message.content)}`
    )
    .join("\n")
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

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: string | undefined) {
  return value?.trim() || ""
}
