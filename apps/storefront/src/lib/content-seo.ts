import type { ContentEntry } from "@/lib/types"

/**
 * Normalizes the freeform `seo_json` stored on a content entry (written by
 * humans or the content.seo / content.faq AI tasks) into typed overrides the
 * storefront renders. Every field is optional; callers fall back to derived
 * defaults. This is what makes AI-generated SEO/AEO/GEO output actually surface.
 */

export type ContentFaqItem = { question: string; answer: string }

export type ContentSeoOverrides = {
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  ogImage: string | null
  faq: ContentFaqItem[]
  keyFacts: string[]
}

export function resolveContentSeo(entry: ContentEntry): ContentSeoOverrides {
  const seo = isRecord(entry.seo_json) ? entry.seo_json : {}

  return {
    metaTitle: readText(seo, ["meta_title", "metaTitle", "title"]),
    metaDescription: readText(seo, [
      "meta_description",
      "metaDescription",
      "description",
      "summary",
    ]),
    canonicalUrl: readText(seo, ["canonical_url", "canonicalUrl", "canonical"]),
    ogImage: readText(seo, ["og_image", "ogImage", "image", "social_image"]),
    faq: readFaq(seo),
    keyFacts: readStringList(seo, ["key_facts", "keyFacts", "facts"]),
  }
}

function readFaq(seo: Record<string, unknown>): ContentFaqItem[] {
  const raw = seo.faq ?? seo.faqs ?? seo.questions
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((item) => {
      if (!isRecord(item)) {
        return null
      }
      const question = firstString(item, ["question", "q", "title"])
      const answer = firstString(item, ["answer", "a", "body", "text"])
      return question && answer ? { question, answer } : null
    })
    .filter((item): item is ContentFaqItem => item !== null)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readText(source: Record<string, unknown>, keys: string[]): string | null {
  return firstString(source, keys) || null
}

function firstString(source: Record<string, unknown>, keys: string[]): string {
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
  }
  return []
}
