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
    content_type: entry.contentType,
    status: "published",
    author_name: entry.authorName || null,
    topic: entry.topic || null,
    tags_json: entry.tags.length ? entry.tags : null,
    related_product_handles_json: entry.relatedProductHandles.length
      ? entry.relatedProductHandles
      : null,
    ai_assisted: false,
    published_at: entry.publishedAt || null,
    created_at: entry.publishedAt || null,
  }))
}
