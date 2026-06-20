import { getAIRuntimeConfig } from "../config"

describe("ai core config", () => {
  it("supports provider-agnostic endpoint and key references", () => {
    const config = getAIRuntimeConfig({
      AI_ENABLED: "true",
      AI_DEFAULT_PROVIDER: "openrouter",
      AI_PROVIDER_CONFIGS_JSON: JSON.stringify([
        {
          code: "openrouter",
          label: "OpenRouter",
          provider_kind: "router",
          protocol: "chat-completions",
          base_url: "https://openrouter.ai/api/v1/",
          api_key_env: "OPENROUTER_API_KEY",
          default_model: "provider/model",
        },
      ]),
      OPENROUTER_API_KEY: "secret",
    })

    expect(config).toMatchObject({
      enabled: true,
      default_provider_code: "openrouter",
      providers: [
        {
          code: "openrouter",
          base_url: "https://openrouter.ai/api/v1",
          api_key_env: "OPENROUTER_API_KEY",
          api_key_configured: true,
          capabilities: ["text.generate"],
          default_model: "provider/model",
          status: "configured",
        },
      ],
    })
  })

  it("never exposes inline secret-like provider fields", () => {
    const config = getAIRuntimeConfig({
      AI_PROVIDER_CONFIGS_JSON: JSON.stringify([
        {
          code: "custom-ai",
          api_key: "plain-secret",
          api_key_env: "CUSTOM_AI_API_KEY",
          metadata: {
            nested_token: "secret-token",
            public_label: "visible",
          },
        },
      ]),
      CUSTOM_AI_API_KEY: "secret",
    })

    expect(JSON.stringify(config)).not.toContain("plain-secret")
    expect(JSON.stringify(config)).not.toContain("secret-token")
    expect(config.providers[0]).toMatchObject({
      api_key_env: "CUSTOM_AI_API_KEY",
      status: "invalid",
      metadata: {
        nested_token: "[redacted]",
        public_label: "visible",
      },
    })
  })

  it("marks providers that need a missing environment secret", () => {
    const config = getAIRuntimeConfig({
      AI_PROVIDER_CONFIGS_JSON: JSON.stringify([
        {
          code: "claude-compatible",
          protocol: "messages",
          base_url: "https://api.example.test",
          api_key_env: "CLAUDE_API_KEY",
        },
      ]),
    })

    expect(config.providers[0]).toMatchObject({
      status: "missing_secret",
      api_key_configured: false,
    })
  })

  it("accepts provider-neutral capability declarations", () => {
    const config = getAIRuntimeConfig({
      AI_PROVIDER_CONFIGS_JSON: JSON.stringify([
        {
          code: "relay",
          protocol: "custom-http",
          api_key_env: "AI_RELAY_KEY",
          capabilities: "text.generate, speech.tts, speech.stt",
        },
      ]),
      AI_RELAY_KEY: "secret",
    })

    expect(config.providers[0]).toMatchObject({
      code: "relay",
      capabilities: ["text.generate", "speech.tts", "speech.stt"],
      status: "configured",
    })
  })
})
