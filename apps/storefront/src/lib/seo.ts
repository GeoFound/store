import type { Metadata } from "next"
import { getSiteConfig } from "@/lib/site-config"

/**
 * Phase 0 discoverability helpers. These read deployment-level configuration at
 * request time so SEO behavior can differ per site/environment without a
 * rebuild. Structured data (JSON-LD) and the canonical seo document are Phase 1
 * — see docs/seo-aeo-geo-architecture.md.
 */

// Known generative/answer-engine crawlers. Allowed by default (GEO), but
// blockable per site via SEO_AI_CRAWLERS_ALLOWED.
export const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
]

// Parses a boolean-ish env value. Static `process.env.X` reads at the call
// sites keep every key auditable in .ai/config-surface.json (no dynamic access).
function parseFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback
  }
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
}

/** Master capability switch (default on). */
export function isSeoEnabled(): boolean {
  return parseFlag(process.env.SEO_ENABLED, true)
}

/**
 * Whether the site may be indexed. Staging/preview deployments set
 * SEO_INDEXING_ENABLED=false to force a global noindex.
 */
export function isIndexingEnabled(): boolean {
  return isSeoEnabled() && parseFlag(process.env.SEO_INDEXING_ENABLED, true)
}

/** Whether generative/answer-engine crawlers may access the site (default on). */
export function aiCrawlersAllowed(): boolean {
  return parseFlag(process.env.SEO_AI_CRAWLERS_ALLOWED, true)
}

function ensureScheme(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "")
}

/** Canonical base URL for the current site. */
export function getSiteUrl(): string {
  const explicit =
    process.env.STOREFRONT_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_STOREFRONT_URL?.trim() ||
    process.env.SITE_CANONICAL_URL?.trim()
  const raw = explicit || `https://${getSiteConfig().domains.storefront}`
  return stripTrailingSlash(ensureScheme(raw))
}

/** Resolves a path or already-absolute URL into an absolute canonical URL. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  return `${getSiteUrl()}/${path.replace(/^\/+/, "")}`
}

type PageMetadataInput = {
  title?: string | null
  description?: string | null
  path: string
  canonicalUrl?: string | null
  image?: string | null
  type?: "website" | "article"
  publishedTime?: string | null
}

/**
 * Builds per-page metadata (canonical, Open Graph, Twitter, robots) from a
 * consumer-agnostic input. Title flows through the layout's title template.
 */
export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const siteConfig = getSiteConfig()
  const url = absoluteUrl(input.canonicalUrl?.trim() || input.path)
  const title = input.title?.trim() || undefined
  const description = input.description?.trim() || siteConfig.site.description
  const ogLocale = (siteConfig.site.locale || "en-US").replace("-", "_")
  const images = input.image ? [absoluteUrl(input.image)] : undefined
  const indexable = isIndexingEnabled()

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title: title || siteConfig.site.name,
      description,
      url,
      siteName: siteConfig.site.name,
      locale: ogLocale,
      type: input.type || "website",
      ...(images ? { images } : {}),
      ...(input.type === "article" && input.publishedTime
        ? { publishedTime: input.publishedTime }
        : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: title || siteConfig.site.name,
      description,
      ...(images ? { images } : {}),
    },
  }
}
