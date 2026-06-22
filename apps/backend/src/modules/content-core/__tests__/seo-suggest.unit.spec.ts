import { buildSeoSuggestionMessages, suggestSeoFixes } from "../seo-suggest"

describe("buildSeoSuggestionMessages", () => {
  it("includes current fields and findings, and asks for strict JSON", () => {
    const messages = buildSeoSuggestionMessages(
      { meta_title: "Old title", canonical_url: "https://x" },
      [{ id: "faq-missing", severity: "info", field: "faq_json", message: "No FAQ." }]
    )

    expect(messages).toHaveLength(2)
    expect(messages[0].content).toContain("STRICT JSON")
    expect(String(messages[1].content)).toContain("Old title")
    expect(String(messages[1].content)).toContain("[info] faq_json: No FAQ.")
  })
})

describe("suggestSeoFixes", () => {
  const repo = {
    retrieveContentSeoDocumentSafe: async () => ({
      meta_title: "Short",
      status: "published",
    }),
    createAITaskRunSafe: async () => ({ id: "run_1" }),
  }

  it("returns not-configured when the AI runtime is unavailable", async () => {
    const result = await suggestSeoFixes(repo, {
      scope: { resolve: () => undefined },
      entityType: "product",
      entityId: "p1",
    })

    expect(result.configured).toBe(false)
    expect(result.run_id).toBeNull()
    expect(result.findings.length).toBeGreaterThan(0)
  })

  it("invokes the AI runtime, persists a review-gated run, and returns suggestions", async () => {
    let createdRun: Record<string, unknown> | null = null
    const aiCore = {
      invokeForCapabilitySafe: jest.fn(async () => ({
        provider_code: "openrouter",
        provider_protocol: "chat-completions",
        capability: "text.generate",
        model: "publisher/model",
        output_text: '{"meta_title":"Better title"}',
        output: { meta_title: "Better title" },
        usage: { total_tokens: 20 },
      })),
    }
    const trackingRepo = {
      retrieveContentSeoDocumentSafe: async () => ({ status: "draft" }),
      createAITaskRunSafe: async (input: Record<string, unknown>) => {
        createdRun = input
        return { id: "run_2" }
      },
    }

    const result = await suggestSeoFixes(trackingRepo, {
      scope: { resolve: () => aiCore },
      entityType: "content_entry",
      entityId: "c1",
      siteId: "global",
    })

    expect(aiCore.invokeForCapabilitySafe).toHaveBeenCalledTimes(1)
    expect(result.configured).toBe(true)
    expect(result.run_id).toBe("run_2")
    expect(result.suggestion?.output).toEqual({ meta_title: "Better title" })
    expect(createdRun).toMatchObject({
      status: "requires_review",
      taskType: "custom",
    })
  })
})
