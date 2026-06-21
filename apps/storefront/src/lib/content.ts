import {
  listPublishedContentEntries,
  retrievePublishedContentEntry,
} from "./commerce"
import { getSiteConfig, type SiteInsightEntryConfig } from "./site-config"
import type { ContentEntry } from "./types"

export async function listContentEntries(input?: {
  limit?: number
}): Promise<ContentEntry[]> {
  const siteConfig = getSiteConfig()
  const fallback = seedEntriesToContentEntries(
    siteConfig.content.insights.seedEntries,
    siteConfig.site.id
  ).slice(0, input?.limit || 100)

  const entries = await listPublishedContentEntries({
    siteId: siteConfig.site.id,
    limit: input?.limit,
  }).catch(() => [])

  if (!entries.length) {
    return fallback
  }

  return entries
}

export async function retrieveContentEntry(
  slug: string
): Promise<ContentEntry | null> {
  const siteConfig = getSiteConfig()
  const fallback =
    seedEntriesToContentEntries(
      siteConfig.content.insights.seedEntries,
      siteConfig.site.id
    ).find((entry) => entry.slug === slug) || null

  const entry = await retrievePublishedContentEntry({
    siteId: siteConfig.site.id,
    slug,
  }).catch(() => null)

  return entry || fallback
}

function seedEntriesToContentEntries(
  entries: SiteInsightEntryConfig[],
  siteId: string
): ContentEntry[] {
  return entries.map((entry) => ({
    id: `seed:${siteId}:${entry.slug}`,
    site_id: siteId,
    slug: entry.slug,
    title: entry.title,
    excerpt: entry.excerpt,
    body: entry.body,
    content_format: "markdown",
    content_type: entry.contentType,
    status: "published",
    author_name: entry.authorName || null,
    cover_image_url: null,
    audio_url: null,
    language: null,
    topic: entry.topic || null,
    tags_json: entry.tags.length ? entry.tags : null,
    related_product_handles_json: entry.relatedProductHandles.length
      ? entry.relatedProductHandles
      : null,
    ai_assisted: false,
    seo_json: null,
    reading_time_minutes: estimateReadingMinutes(entry.body),
    word_count: estimateWords(entry.body),
    published_at: entry.publishedAt || null,
    created_at: entry.publishedAt || null,
    cover_asset: null,
    audio_asset: null,
    audio: null,
  }))
}

// NOTE: Mirrors the backend heuristic in
// apps/backend/src/modules/content-core/service-helpers.ts (getReadingStats) so
// seed entries report the same reading time as persisted ones. Keep in sync.
function estimateWords(value: string) {
  const latinWords = value.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) || []
  const cjk = value.match(/[\u3040-\u30ff\u3400-\u9fff]/g) || []

  return latinWords.length + cjk.length
}

function estimateReadingMinutes(value: string) {
  const words = estimateWords(value)

  return words ? Math.max(1, Math.ceil(words / 220)) : null
}
