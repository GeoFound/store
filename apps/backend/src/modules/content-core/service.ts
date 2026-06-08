import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import ContentEntry from "./models/content-entry"
import type {
  ContentEntryListInput,
  ContentEntryStatus,
  ContentEntryType,
  CreateContentEntryInput,
  UpdateContentEntryInput,
} from "./types"

const DEFAULT_SITE_ID = "global"
const CONTENT_TYPES = new Set<ContentEntryType>([
  "article",
  "guide",
  "report",
  "review",
  "resource",
  "case_study",
])
const STATUSES = new Set<ContentEntryStatus>([
  "draft",
  "review",
  "published",
  "archived",
])

class ContentCoreModuleService extends MedusaService({
  ContentEntry,
}) {
  async createEntrySafe(input: CreateContentEntryInput) {
    const siteId = normalizeSiteId(input.siteId)
    const slug = normalizeSlug(input.slug)

    await this.assertSlugIsUnique(siteId, slug)

    const status = normalizeStatus(input.status, "draft")
    const publishedAt = resolvePublishedAt(status, input.publishedAt)

    return this.createContentEntries({
      site_id: siteId,
      slug,
      title: requireText(input.title, "content title"),
      excerpt: toNullableText(input.excerpt),
      body: toNullableText(input.body),
      content_type: normalizeContentType(input.contentType, "article"),
      status,
      author_name: toNullableText(input.authorName),
      cover_image_url: toNullableText(input.coverImageUrl),
      topic: toNullableText(input.topic),
      tags_json: normalizeStringArray(input.tags),
      seo_json: normalizeRecord(input.seo),
      source_refs_json: normalizeJsonLike(input.sourceRefs),
      related_product_handles_json: normalizeStringArray(input.relatedProductHandles),
      ai_assisted: Boolean(input.aiAssisted),
      published_at: publishedAt,
      metadata_json: normalizeRecord(input.metadata),
    } as any)
  }

  async updateEntrySafe(input: UpdateContentEntryInput) {
    const id = requireText(input.id, "content entry id")
    const existing = await this.retrieveContentEntry(id)
    const nextSiteId =
      typeof input.siteId === "undefined"
        ? String(existing.site_id || DEFAULT_SITE_ID)
        : normalizeSiteId(input.siteId)
    const nextSlug =
      typeof input.slug === "undefined"
        ? String(existing.slug)
        : normalizeSlug(input.slug)

    if (nextSiteId !== existing.site_id || nextSlug !== existing.slug) {
      await this.assertSlugIsUnique(nextSiteId, nextSlug, id)
    }

    const nextStatus =
      typeof input.status === "undefined"
        ? (existing.status as ContentEntryStatus)
        : normalizeStatus(input.status, existing.status as ContentEntryStatus)
    const publishedAt =
      typeof input.publishedAt === "undefined"
        ? nextStatus === "published"
          ? existing.published_at || new Date()
          : null
        : resolvePublishedAt(nextStatus, input.publishedAt)

    return this.updateContentEntries({
      id,
      site_id: nextSiteId,
      slug: nextSlug,
      ...(typeof input.title === "undefined"
        ? {}
        : { title: requireText(input.title, "content title") }),
      ...(typeof input.excerpt === "undefined"
        ? {}
        : { excerpt: toNullableText(input.excerpt) }),
      ...(typeof input.body === "undefined"
        ? {}
        : { body: toNullableText(input.body) }),
      ...(typeof input.contentType === "undefined"
        ? {}
        : { content_type: normalizeContentType(input.contentType, "article") }),
      status: nextStatus,
      ...(typeof input.authorName === "undefined"
        ? {}
        : { author_name: toNullableText(input.authorName) }),
      ...(typeof input.coverImageUrl === "undefined"
        ? {}
        : { cover_image_url: toNullableText(input.coverImageUrl) }),
      ...(typeof input.topic === "undefined"
        ? {}
        : { topic: toNullableText(input.topic) }),
      ...(typeof input.tags === "undefined"
        ? {}
        : { tags_json: normalizeStringArray(input.tags) }),
      ...(typeof input.seo === "undefined"
        ? {}
        : { seo_json: normalizeRecord(input.seo) }),
      ...(typeof input.sourceRefs === "undefined"
        ? {}
        : { source_refs_json: normalizeJsonLike(input.sourceRefs) }),
      ...(typeof input.relatedProductHandles === "undefined"
        ? {}
        : {
            related_product_handles_json: normalizeStringArray(
              input.relatedProductHandles
            ),
          }),
      ...(typeof input.aiAssisted === "undefined"
        ? {}
        : { ai_assisted: Boolean(input.aiAssisted) }),
      published_at: publishedAt,
      ...(typeof input.metadata === "undefined"
        ? {}
        : { metadata_json: normalizeRecord(input.metadata) }),
    } as any)
  }

  async listEntriesSafe(input?: ContentEntryListInput) {
    const entries = await this.listContentEntries(
      {
        ...(input?.siteId ? { site_id: normalizeSiteId(input.siteId) } : {}),
        ...(input?.status ? { status: normalizeStatus(input.status, "draft") } : {}),
        ...(input?.contentType
          ? { content_type: normalizeContentType(input.contentType, "article") }
          : {}),
        ...(input?.topic ? { topic: toNullableText(input.topic) } : {}),
      },
      {
        take: normalizeLimit(input?.limit, 100),
        order: {
          published_at: "DESC",
          created_at: "DESC",
        },
      }
    )

    return filterByTag(entries, input?.tag)
  }

  async listPublishedEntriesSafe(input?: Omit<ContentEntryListInput, "status">) {
    const siteIds = resolveVisibleSiteIds(input?.siteId)
    const entries = await this.listContentEntries(
      {
        status: "published",
        ...(siteIds ? { site_id: siteIds } : {}),
        ...(input?.contentType
          ? { content_type: normalizeContentType(input.contentType, "article") }
          : {}),
        ...(input?.topic ? { topic: toNullableText(input.topic) } : {}),
      },
      {
        take: normalizeLimit(input?.limit, 100),
        order: {
          published_at: "DESC",
          created_at: "DESC",
        },
      }
    )

    return filterByTag(entries, input?.tag)
  }

  async retrievePublishedEntryBySlugSafe(input: {
    slug: string
    siteId?: string | null
  }) {
    const siteId = normalizeSiteId(input.siteId)
    const slug = normalizeSlug(input.slug)
    const entries = await this.listContentEntries(
      {
        status: "published",
        slug,
        site_id: [siteId, DEFAULT_SITE_ID],
      },
      {
        take: 2,
        order: {
          published_at: "DESC",
          created_at: "DESC",
        },
      }
    )

    return (
      entries.find((entry) => String(entry.site_id) === siteId) ||
      entries.find((entry) => String(entry.site_id) === DEFAULT_SITE_ID) ||
      null
    )
  }

  private async assertSlugIsUnique(
    siteId: string,
    slug: string,
    ignoreEntryId?: string
  ) {
    const existing = await this.listContentEntries(
      {
        site_id: siteId,
        slug,
      },
      {
        take: 1,
      }
    )

    const duplicate = existing.find((entry) => String(entry.id) !== ignoreEntryId)

    if (duplicate) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        "Content slug already exists for this site"
      )
    }
  }
}

function filterByTag<T extends { tags_json?: unknown }>(entries: T[], tag?: string | null) {
  const normalizedTag = normalizeTag(tag)

  if (!normalizedTag) {
    return entries
  }

  return entries.filter((entry) => {
    const tags = normalizeStringArray(entry.tags_json)
    return Boolean(tags?.includes(normalizedTag))
  })
}

function resolveVisibleSiteIds(siteId?: string | null) {
  const normalized = normalizeSiteId(siteId)

  if (normalized === DEFAULT_SITE_ID) {
    return [DEFAULT_SITE_ID]
  }

  return [normalized, DEFAULT_SITE_ID]
}

function normalizeSiteId(value: unknown) {
  const normalized = toText(value) || DEFAULT_SITE_ID

  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalized)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "site id must be 1-64 chars of a-z, 0-9, _, -"
    )
  }

  return normalized
}

function normalizeSlug(value: unknown) {
  const slug = toText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (!slug || slug.length < 2 || slug.length > 140) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "content slug must be 2-140 URL-safe characters"
    )
  }

  return slug
}

function requireText(value: unknown, label: string) {
  const normalized = toText(value)

  if (!normalized) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `${label} is required`)
  }

  return normalized
}

function toText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function toNullableText(value: unknown) {
  const text = toText(value)
  return text || null
}

function normalizeStatus(value: unknown, fallback: ContentEntryStatus) {
  return STATUSES.has(value as ContentEntryStatus)
    ? (value as ContentEntryStatus)
    : fallback
}

function normalizeContentType(value: unknown, fallback: ContentEntryType) {
  return CONTENT_TYPES.has(value as ContentEntryType)
    ? (value as ContentEntryType)
    : fallback
}

function normalizeStringArray(value: unknown) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : []

  const values = source
    .map((item) => normalizeTag(item))
    .filter((item): item is string => Boolean(item))

  return values.length ? Array.from(new Set(values)) : null
}

function normalizeTag(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 64)
}

function normalizeRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function normalizeJsonLike(value: unknown) {
  if (!value) {
    return null
  }

  if (Array.isArray(value)) {
    return value.length ? value : null
  }

  if (typeof value === "object") {
    return value as Record<string, unknown>
  }

  return null
}

function normalizeLimit(value: unknown, fallback: number) {
  const numberValue =
    typeof value === "number" ? value : Number.parseInt(String(value || ""), 10)

  if (!Number.isFinite(numberValue) || numberValue < 1) {
    return fallback
  }

  return Math.min(Math.floor(numberValue), 200)
}

function resolvePublishedAt(
  status: ContentEntryStatus,
  value?: string | Date | null
) {
  if (value === null || status !== "published") {
    return null
  }

  if (typeof value === "undefined") {
    return status === "published" ? new Date() : null
  }

  const date = value instanceof Date ? value : new Date(value)

  if (!Number.isFinite(date.getTime())) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid published date")
  }

  return date
}

export default ContentCoreModuleService
