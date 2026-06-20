import { buildContentTaskMessages, summarizeOutput } from "../ai-prompts"

describe("content AI prompt construction", () => {
  it("builds system + user messages for a text-generation task", () => {
    const messages = buildContentTaskMessages(
      "content.article_draft",
      {
        title: "Prepaid gift cards",
        instructions: "Focus on regional availability.",
        keywords: ["gift cards", "prepaid"],
        language: "en",
      },
      [{ title: "Vendor doc", url: "https://example.test", snippet: "Coverage map" }]
    )

    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({ role: "system" })
    expect(messages[0].content).toContain("senior content writer")
    expect(messages[1].role).toBe("user")
    expect(messages[1].content).toContain("Topic: Prepaid gift cards")
    expect(messages[1].content).toContain("Target keywords: gift cards, prepaid")
    expect(messages[1].content).toContain("Vendor doc — https://example.test")
  })

  it("returns no messages for tasks without a text prompt template", () => {
    expect(buildContentTaskMessages("content.tts", { body: "Read me" })).toEqual([])
  })

  it("returns no messages when there is nothing to send", () => {
    expect(buildContentTaskMessages("content.seo", {})).toEqual([])
  })

  it("summarizes output to a single trimmed line", () => {
    expect(summarizeOutput("  multi\n  line\toutput  ")).toBe("multi line output")
    expect(summarizeOutput("")).toBeNull()
    expect(summarizeOutput(null)).toBeNull()
    expect(summarizeOutput("a".repeat(400))).toHaveLength(278)
  })
})
