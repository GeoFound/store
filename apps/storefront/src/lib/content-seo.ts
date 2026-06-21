import type { ContentEntry, SeoDocument } from "@/lib/types"

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
    faq: parseFaqList(seo.faq ?? seo.faqs ?? seo.questions),
    keyFacts: readStringList(seo, ["key_facts", "keyFacts", "facts"]),
  }
}

/**
 * Typed overrides resolved from a canonical content_seo_document (the uniform
 * record covering products/collections, served by /store/content/seo). Same
 * precedence rule as resolveContentSeo: a present field overrides the derived
 * default.
 */
export type SeoDocumentOverrides = {
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  ogImage: string | null
  faq: ContentFaqItem[]
  keyFacts: string[]
  schemaJson: Record<string, unknown> | null
}

export function resolveSeoDocumentOverrides(
  doc: SeoDocument | null | undefined
): SeoDocumentOverrides {
  const d = isRecord(doc) ? (doc as Record<string, unknown>) : {}

  return {
    metaTitle: readText(d, ["meta_title"]),
    metaDescription: readText(d, ["meta_description", "summary_tldr"]),
    canonicalUrl: readText(d, ["canonical_url"]),
    ogImage: readText(d, ["og_image_url"]),
    faq: parseFaqList(d.faq_json),
    keyFacts: readStringList(d, ["key_facts_json"]),
    schemaJson: isRecord(d.schema_json) ? d.schema_json : null,
  }
}

function parseFaqList(raw: unknown): ContentFaqItem[] {
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
