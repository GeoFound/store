export type AIProviderStatus =
  | "configured"
  | "disabled"
  | "invalid"
  | "missing_key_ref"
  | "missing_secret"

export type AIProviderConfigSafe = {
  code: string
  label: string
  provider_kind: string
  protocol: string
  base_url: string | null
  default_model: string | null
  capabilities: string[]
  api_key_env: string | null
  api_key_configured: boolean
  requires_api_key: boolean
  enabled: boolean
  site_ids: string[]
  priority: number
  status: AIProviderStatus
  issues: string[]
  metadata: Record<string, unknown> | null
}

export type AIRuntimeConfig = {
  enabled: boolean
  default_provider_code: string | null
  providers: AIProviderConfigSafe[]
  issues: string[]
}

export type AIInvokeSafeInput = {
  capability: string
  providerCode?: string | null
  siteId?: string | null
  model?: string | null
  messages?: Array<{
    role: string
    content: string | Array<Record<string, unknown>>
  }>
  prompt?: string | null
  input?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

export type AITaskRunSafe = {
  id: string
  task_type: string
  plugin_code: string
  provider_code: string | null
  site_id: string | null
  status: "queued" | "running" | "succeeded" | "failed" | "canceled" | "requires_review"
  input_summary: string | null
  output_summary: string | null
  source_refs: Array<Record<string, unknown>>
  artifact_refs: Array<Record<string, unknown>>
  error_message: string | null
  created_at: string | null
  updated_at: string | null
}
