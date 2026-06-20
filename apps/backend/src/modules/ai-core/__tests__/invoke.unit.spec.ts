import { invokeAIForCapability } from "../invoke"

function jsonResponse(body: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? "application/json" : null,
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

describe("ai core invoke", () => {
  it("invokes an OpenAI-compatible text provider without vendor lock-in", async () => {
    const fetcher = jest.fn(async () =>
      jsonResponse({
        choices: [
          {
            message: {
              content: "Draft body",
            },
          },
        ],
        usage: {
          total_tokens: 12,
        },
      })
    )

    const result = await invokeAIForCapability({
      capability: "text.generate",
      providerCode: "openrouter",
      prompt: "Write an article",
      env: {
        AI_ENABLED: "true",
        AI_PROVIDER_CONFIGS_JSON: JSON.stringify([
          {
            code: "openrouter",
            protocol: "chat-completions",
            base_url: "https://openrouter.ai/api/v1",
            api_key_env: "OPENROUTER_API_KEY",
            default_model: "publisher/model",
          },
        ]),
        OPENROUTER_API_KEY: "secret",
      },
      fetcher,
    })

    expect(fetcher).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer secret",
        }),
      })
    )
    expect(result).toMatchObject({
      provider_code: "openrouter",
      capability: "text.generate",
      model: "publisher/model",
      output_text: "Draft body",
      usage: {
        total_tokens: 12,
      },
    })
  })

  it("invokes speech-capable custom relays by capability", async () => {
    const fetcher = jest.fn(async () =>
      jsonResponse({
        output: {
          audio_url: "https://cdn.example.test/article.mp3",
        },
      })
    )

    const result = await invokeAIForCapability({
      capability: "speech.tts",
      providerCode: "voice-relay",
      prompt: "Read this article",
      env: {
        AI_ENABLED: "true",
        AI_PROVIDER_CONFIGS_JSON: JSON.stringify([
          {
            code: "voice-relay",
            protocol: "custom-http",
            base_url: "https://ai-relay.example.test/content-tts",
            api_key_env: "VOICE_RELAY_KEY",
            capabilities: ["speech.tts"],
          },
        ]),
        VOICE_RELAY_KEY: "secret",
      },
      fetcher,
    })

    expect(fetcher).toHaveBeenCalledWith(
      "https://ai-relay.example.test/content-tts",
      expect.objectContaining({
        body: expect.stringContaining("\"capability\":\"speech.tts\""),
      })
    )
    expect(result.output).toEqual({
      audio_url: "https://cdn.example.test/article.mp3",
    })
  })

  it("delegates to a registered provider implementation instead of HTTP", async () => {
    const fetcher = jest.fn()
    const invoke = jest.fn(async () => ({
      outputText: "Relayed draft",
      usage: { total_tokens: 7 },
    }))

    const result = await invokeAIForCapability({
      capability: "text.generate",
      providerCode: "local-model",
      prompt: "Write an article",
      env: {
        AI_ENABLED: "true",
        AI_PROVIDER_CONFIGS_JSON: JSON.stringify([
          {
            code: "local-model",
            protocol: "custom-http",
            base_url: "https://unused.example.test",
            requires_api_key: false,
            capabilities: ["text.generate"],
          },
        ]),
      },
      fetcher,
      resolveRegisteredProvider: (code) =>
        code === "local-model" ? { code, invoke } : null,
    })

    expect(fetcher).not.toHaveBeenCalled()
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      provider_code: "local-model",
      capability: "text.generate",
      output_text: "Relayed draft",
      output: { text: "Relayed draft" },
      usage: { total_tokens: 7 },
    })
  })
})
