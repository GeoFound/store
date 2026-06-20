import { MedusaError } from "@medusajs/framework/utils"
import crypto from "node:crypto"
import type {
  ContentAIReviewStatus,
  ContentAITaskStatus,
  ContentAITaskType,
  ContentAssetType,
  ContentEntryStatus,
  ContentEntryType,
  ContentFormat,
  ContentPublicationChannel,
  ContentRevisionStatus,
  ContentStorageProviderKind,
  CreateContentAssetInput,
} from "./types"
import { buildContentObjectKey, getContentStorageRuntimeConfig } from "./storage"

export const DEFAULT_SITE_ID = "global"

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
const CONTENT_FORMATS = new Set<ContentFormat>([
  "plain_text",
  "markdown",
  "html",
  "portable_json",
])
const REVISION_STATUSES = new Set<ContentRevisionStatus>([
  "draft",
  "review",
  "published",
  "superseded",
  "archived",
])
const ASSET_TYPES = new Set<ContentAssetType>([
  "cover_image",
  "inline_image",
  "audio",
  "attachment",
  "transcript",
  "source",
])
const STORAGE_PROVIDER_KINDS = new Set<ContentStorageProviderKind>([
  "local",
  "s3",
  "r2",
  "external",
])
const PUBLICATION_CHANNELS = new Set<ContentPublicationChannel>([
  "storefront",
  "rss",
  "sitemap",
  "api",
  "social",
])
const AI_TASK_TYPES = new Set<ContentAITaskType>([
  "article_outline",
  "article_draft",
  "article_rewrite",
  "seo",
  "summary",
  "readability",
  "fact_check",
  "translation",
  "tts",
  "stt",
  "custom",
])
const AI_TASK_STATUSES = new Set<ContentAITaskStatus>([
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
  "requires_review",
])
const AI_REVIEW_STATUSES = new Set<ContentAIReviewStatus>([
  "pending",
  "approved",
  "rejected",
  "needs_changes",
  "not_required",
])

export type PatchField<I> = {
  key: keyof I
  column: string
  map?: (value: unknown) => unknown
}

/**
 * Builds a partial-update record from `input`, including only the columns whose
 * source key is explicitly provided (i.e. not `undefined`). Each field may
 * supply a `map` to normalize the value into its persisted form. This keeps the
 * service update methods declarative instead of repeating a
 * `typeof x === "undefined" ? {} : { column: normalize(x) }` block per column.
 */
export function buildPatch<I extends object>(
  input: I,
  fields: Array<PatchField<I>>
) {
  const patch: Record<string, unknown> = {}

  for (const field of fields) {
    if (typeof input[field.key] === "undefined") {
      continue
    }

    const value = input[field.key]
    patch[field.column] = field.map ? field.map(value) : value
  }

  return patch
}

export function filterByTag<T extends { tags_json?: unknown }>(
  entries: T[],
  tag?: string | null
) {
  const normalizedTag = normalizeTag(tag)

  if (!normalizedTag) {
    return entries
  }

  return entries.filter((entry) => {
    const tags = normalizeStringArray(entry.tags_json)
    return Boolean(tags?.includes(normalizedTag))
  })
}

export function resolveVisibleSiteIds(siteId?: string | null) {
  const normalized = normalizeSiteId(siteId)

  if (normalized === DEFAULT_SITE_ID) {
    return [DEFAULT_SITE_ID]
  }

  return [normalized, DEFAULT_SITE_ID]
}

export function normalizeSiteId(value: unknown) {
  const normalized = toText(value) || DEFAULT_SITE_ID

  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalized)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "site id must be 1-64 chars of a-z, 0-9, _, -"
    )
  }

  return normalized
}

export function normalizeSlug(value: unknown) {
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

export function requireText(value: unknown, label: string) {
  const normalized = toText(value)

  if (!normalized) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `${label} is required`)
  }

  return normalized
}

export function toText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

export function toNullableText(value: unknown) {
  const text = toText(value)
  return text || null
}

export function normalizeStatus(value: unknown, fallback: ContentEntryStatus) {
  return STATUSES.has(value as ContentEntryStatus)
    ? (value as ContentEntryStatus)
    : fallback
}

export function normalizeContentType(value: unknown, fallback: ContentEntryType) {
  return CONTENT_TYPES.has(value as ContentEntryType)
    ? (value as ContentEntryType)
    : fallback
}

export function normalizeContentFormat(value: unknown, fallback: ContentFormat) {
  return CONTENT_FORMATS.has(value as ContentFormat)
    ? (value as ContentFormat)
    : fallback
}

export function normalizeRevisionStatus(
  value: unknown,
  fallback: ContentRevisionStatus
) {
  return REVISION_STATUSES.has(value as ContentRevisionStatus)
    ? (value as ContentRevisionStatus)
    : fallback
}

export function normalizeAssetType(value: unknown, fallback: ContentAssetType) {
  return ASSET_TYPES.has(value as ContentAssetType)
    ? (value as ContentAssetType)
    : fallback
}

export function normalizeStorageProviderKind(
  value: unknown,
  fallback: ContentStorageProviderKind
) {
  return STORAGE_PROVIDER_KINDS.has(value as ContentStorageProviderKind)
    ? (value as ContentStorageProviderKind)
    : fallback
}

export function normalizePublicationChannel(
  value: unknown,
  fallback: ContentPublicationChannel
) {
  return PUBLICATION_CHANNELS.has(value as ContentPublicationChannel)
    ? (value as ContentPublicationChannel)
    : fallback
}

export function normalizeAITaskType(value: unknown, fallback: ContentAITaskType) {
  return AI_TASK_TYPES.has(value as ContentAITaskType)
    ? (value as ContentAITaskType)
    : fallback
}

export function normalizeAITaskStatus(
  value: unknown,
  fallback: ContentAITaskStatus
) {
  return AI_TASK_STATUSES.has(value as ContentAITaskStatus)
    ? (value as ContentAITaskStatus)
    : fallback
}

export function normalizeAIReviewStatus(
  value: unknown,
  fallback: ContentAIReviewStatus
) {
  return AI_REVIEW_STATUSES.has(value as ContentAIReviewStatus)
    ? (value as ContentAIReviewStatus)
    : fallback
}

export function normalizeLanguage(value: unknown) {
  const language = toText(value).toLowerCase()

  if (!language) {
    return null
  }

  if (!/^[a-z]{2,3}(-[a-z0-9]{2,8}){0,2}$/.test(language)) {
    return null
  }

  return language
}

export function normalizeNullableNumber(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") {
    return null
  }

  const numberValue =
    typeof value === "number" ? value : Number.parseFloat(String(value))

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null
}

export function normalizeStringArray(value: unknown) {
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

export function toRecordList(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return isRecordValue(value) ? [value] : []
  }

  return value.filter(isRecordValue)
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function normalizeRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

export function normalizeJsonLike(value: unknown) {
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

export function normalizeLimit(value: unknown, fallback: number) {
  const numberValue =
    typeof value === "number" ? value : Number.parseInt(String(value || ""), 10)

  if (!Number.isFinite(numberValue) || numberValue < 1) {
    return fallback
  }

  return Math.min(Math.floor(numberValue), 200)
}

// NOTE: The storefront mirrors this word-count/reading-time heuristic in
// apps/storefront/src/lib/content.ts (estimateWords/estimateReadingMinutes) so
// seed content matches persisted entries. Keep the two algorithms in sync.
export function getReadingStats(value: unknown) {
  const text = toText(value)

  if (!text) {
    return {
      readingTimeMinutes: null,
      wordCount: null,
    }
  }

  const latinWordCount = (text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) || [])
    .length
  const cjkCount = (text.match(/[\u3040-\u30ff\u3400-\u9fff]/g) || []).length
  const wordCount = latinWordCount + cjkCount

  return {
    readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 220)),
    wordCount,
  }
}

export function getReadabilitySnapshot(value: unknown) {
  const text = toText(value)
  const stats = getReadingStats(text)
  const paragraphs = text
    ? text.split(/\n{2,}/).filter((paragraph) => paragraph.trim()).length
    : 0
  const sentences = text
    ? Math.max(1, (text.match(/[.!?。！？]+/g) || []).length)
    : 0

  return {
    paragraphs,
    reading_time_minutes: stats.readingTimeMinutes,
    sentences,
    word_count: stats.wordCount,
  }
}

export function checksumText(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export function buildCreateAssetRecord(input: CreateContentAssetInput) {
  const storageProviderCode = toNullableText(input.storageProviderCode)
  const storage = getContentStorageRuntimeConfig()
  const selectedProvider =
    (storageProviderCode
      ? storage.providers.find((provider) => provider.code === storageProviderCode)
      : null) ||
    storage.providers.find((provider) => provider.code === storage.default_provider_code) ||
    storage.providers[0] ||
    null
  const assetType = normalizeAssetType(input.assetType, "attachment")
  const objectKey =
    toNullableText(input.objectKey) ||
    buildContentObjectKey({
      assetType,
      entryId: input.entryId,
      filename: input.publicUrl || input.mimeType || "asset.bin",
      siteId: input.siteId,
    })

  return {
    site_id: normalizeSiteId(input.siteId),
    entry_id: toNullableText(input.entryId),
    revision_id: toNullableText(input.revisionId),
    asset_type: assetType,
    storage_provider: normalizeStorageProviderKind(
      input.storageProvider,
      selectedProvider?.kind || "external"
    ),
    storage_provider_code: selectedProvider?.code || storageProviderCode,
    bucket: toNullableText(input.bucket) || selectedProvider?.bucket || null,
    object_key: objectKey,
    public_url: toNullableText(input.publicUrl),
    mime_type: toNullableText(input.mimeType),
    byte_size: normalizeNullableNumber(input.byteSize),
    checksum: toNullableText(input.checksum),
    width: normalizeNullableNumber(input.width),
    height: normalizeNullableNumber(input.height),
    duration_seconds: normalizeNullableNumber(input.durationSeconds),
    alt_text: toNullableText(input.altText),
    caption: toNullableText(input.caption),
    metadata_json: normalizeRecord(input.metadata),
  }
}

export function resolveOptionalDate(value?: string | Date | null) {
  if (value === null || typeof value === "undefined") {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)

  if (!Number.isFinite(date.getTime())) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid date")
  }

  return date
}

export function resolvePublishedAt(
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

type ContentAssetLookupService = {
  listContentAssets(
    filters: Record<string, unknown>,
    config: Record<string, unknown>
  ): Promise<Array<Record<string, unknown>>>
  listContentAudioes(
    filters: Record<string, unknown>,
    config: Record<string, unknown>
  ): Promise<Array<Record<string, unknown>>>
}

export async function attachPublicAssetsForEntries<T extends { id?: unknown }>(
  service: ContentAssetLookupService,
  entries: T[]
) {
  const entryIds = entries
    .map((entry) => String(entry.id || ""))
    .filter(Boolean)

  if (!entryIds.length) {
    return entries
  }

  const [assets, audioRecords] = await Promise.all([
    service.listContentAssets(
      {
        entry_id: entryIds,
      },
      {
        take: Math.min(500, Math.max(50, entryIds.length * 8)),
        order: {
          created_at: "DESC",
        },
      }
    ),
    service.listContentAudioes(
      {
        entry_id: entryIds,
        status: "ready",
      },
      {
        take: Math.min(200, Math.max(50, entryIds.length * 3)),
        order: {
          created_at: "DESC",
        },
      }
    ),
  ])

  return entries.map((entry) => {
    const entryId = String(entry.id || "")
    const record = entry as Record<string, unknown>
    const coverAsset =
      assets.find(
        (asset) =>
          String(asset.entry_id || "") === entryId &&
          String(asset.asset_type || "") === "cover_image"
      ) || null
    const explicitAudioAsset = assets.find(
      (asset) =>
        String(asset.id || "") === String(record.audio_asset_id || "") &&
        String(asset.public_url || "")
    )
    const latestAudioAsset = assets.find(
      (asset) =>
        String(asset.entry_id || "") === entryId &&
        String(asset.asset_type || "") === "audio" &&
        String(asset.public_url || "")
    )
    const audioAsset = explicitAudioAsset || latestAudioAsset || null
    const audioRecord =
      audioRecords.find((audio) => String(audio.entry_id || "") === entryId) ||
      null

    return {
      ...record,
      cover_asset: coverAsset,
      audio_asset: audioAsset,
      audio: audioRecord,
      cover_image_url:
        toNullableText(record.cover_image_url) ||
        toNullableText(coverAsset?.public_url),
      audio_url: toNullableText(audioAsset?.public_url),
    }
  })
}

function normalizeTag(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 64)
}
