import type { AIMessage } from "../../platform/ai"

/**
 * Prompt construction for content AI task plugins. Kept separate from plugin
 * registration/execution so the editorial prompts can evolve (and be unit
 * tested) independently of the runtime wiring.
 */

const SYSTEM_PROMPTS: Record<string, string> = {
  "content.article_outline":
    "You are an editorial planner. Produce a structured outline (H2/H3 headings with a one-line note under each) for the requested article. Keep it scannable and write in the article's language.",
  "content.article_draft":
    "You are a senior content writer. Write a complete, well-structured first draft suitable for human review. Use clear headings, short paragraphs, and stay faithful to the supplied source references. Do not invent facts.",
  "content.article_rewrite":
    "You are a meticulous copy editor. Rewrite the supplied content to improve clarity, tone, and SEO while preserving the original meaning and every factual claim. Return only the rewritten content.",
  "content.seo":
    "You are an SEO specialist. Produce search metadata as JSON with keys: title, meta_description, slug, keywords (array), heading_suggestions (array), and internal_link_ideas (array). Base everything on the supplied content.",
  "content.readability":
    "You are a readability reviewer. Assess structure, scannability, sentence length, and reading friction. Return concrete, prioritized suggestions plus an overall readability verdict.",
}

/** Builds the chat messages for a text-generation content task. */
export function buildContentTaskMessages(
  taskCode: string,
  payload: Record<string, unknown>,
  sourceRefs?: Array<Record<string, unknown>>
): AIMessage[] {
  const system = SYSTEM_PROMPTS[taskCode]

  if (!system) {
    return []
  }

  const userPrompt = composeUserPrompt(payload, sourceRefs)

  if (!userPrompt) {
    return []
  }

  return [
    { role: "system", content: system },
    { role: "user", content: userPrompt },
  ]
}

function composeUserPrompt(
  payload: Record<string, unknown>,
  sourceRefs?: Array<Record<string, unknown>>
): string {
  const sections: string[] = []
  const title = readText(payload, ["title", "topic"])
  const body = readText(payload, ["body", "content", "draft"])
  const excerpt = readText(payload, ["excerpt", "summary"])
  const instructions = readText(payload, ["instructions", "prompt", "brief"])
  const tone = readText(payload, ["tone", "voice"])
  const audience = readText(payload, ["audience"])
  const language = readText(payload, ["language", "locale"])
  const keywords = readStringList(payload, ["keywords", "tags"])

  if (title) {
    sections.push(`Topic: ${title}`)
  }
  if (instructions) {
    sections.push(`Instructions: ${instructions}`)
  }
  if (tone) {
    sections.push(`Tone: ${tone}`)
  }
  if (audience) {
    sections.push(`Audience: ${audience}`)
  }
  if (language) {
    sections.push(`Language: ${language}`)
  }
  if (keywords.length) {
    sections.push(`Target keywords: ${keywords.join(", ")}`)
  }
  if (excerpt) {
    sections.push(`Excerpt:\n${excerpt}`)
  }
  if (body) {
    sections.push(`Content:\n${body}`)
  }

  const references = formatSourceRefs(sourceRefs)
  if (references) {
    sections.push(`Source references:\n${references}`)
  }

  return sections.join("\n\n").trim()
}

function formatSourceRefs(sourceRefs?: Array<Record<string, unknown>>): string {
  if (!Array.isArray(sourceRefs) || !sourceRefs.length) {
    return ""
  }

  return sourceRefs
    .map((ref, index) => {
      const title = readText(ref, ["title", "name"])
      const url = readText(ref, ["url", "href", "source"])
      const snippet = readText(ref, ["snippet", "summary", "text"])
      const label = [title, url].filter(Boolean).join(" — ") || `Reference ${index + 1}`

      return snippet ? `- ${label}\n  ${snippet}` : `- ${label}`
    })
    .join("\n")
}

/** Produces a short, single-line summary of generated output for the run log. */
export function summarizeOutput(text: string | null): string | null {
  if (!text) {
    return null
  }

  const normalized = text.replace(/\s+/g, " ").trim()

  if (!normalized) {
    return null
  }

  return normalized.length > 280 ? `${normalized.slice(0, 277)}…` : normalized
}

function readText(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return ""
}

function readStringList(source: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = source[key]

    if (Array.isArray(value)) {
      return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    }

    if (typeof value === "string" && value.trim()) {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    }
  }

  return []
}
