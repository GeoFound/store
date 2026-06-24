export type StorefrontContentEntry = Record<string, unknown>

export type StorefrontSeoDocument = Record<string, unknown> & {
  status?: unknown
}

export type StorefrontContentEntryListInput = {
  siteId?: string | null
  contentType?: string | null
  topic?: string | null
  tag?: string | null
  limit?: number | string | null
}

export type StorefrontContentEntryQuery = {
  siteId?: string
  contentType?: string
  topic?: string
  tag?: string
  limit?: number
}

export type StorefrontContentEntryBySlugInput = {
  slug?: string | null
  siteId?: string | null
}

export type StorefrontContentEntryBySlugQuery = {
  slug: string
  siteId?: string
}

export type StorefrontSeoDocumentInput = {
  entityType?: string | null
  entityId?: string | null
  siteId?: string | null
  language?: string | null
}

export type StorefrontSeoDocumentQuery = {
  entityType: string
  entityId: string
  siteId?: string
  language?: string
}

export type StorefrontContentRepository = {
  listPublishedEntries(input: StorefrontContentEntryQuery): Promise<StorefrontContentEntry[]>
  retrievePublishedEntryBySlug(
    input: StorefrontContentEntryBySlugQuery
  ): Promise<StorefrontContentEntry | null>
  retrieveSeoDocument(
    input: StorefrontSeoDocumentQuery
  ): Promise<StorefrontSeoDocument | null>
}

export type StorefrontContentApplication = {
  listPublishedEntries(
    input?: StorefrontContentEntryListInput
  ): Promise<StorefrontContentEntry[]>
  getPublishedEntryBySlug(
    input: StorefrontContentEntryBySlugInput
  ): Promise<StorefrontContentEntry | null>
  getPublishedSeoDocument(
    input: StorefrontSeoDocumentInput
  ): Promise<StorefrontSeoDocument | null>
}

export type ContentApplicationErrorCode = "invalid_request"

export class ContentApplicationError extends Error {
  readonly code: ContentApplicationErrorCode

  constructor(code: ContentApplicationErrorCode, message: string) {
    super(message)
    this.name = "ContentApplicationError"
    this.code = code
  }
}

export function isContentApplicationError(
  error: unknown,
  code?: ContentApplicationErrorCode
): error is ContentApplicationError {
  return (
    error instanceof ContentApplicationError &&
    (typeof code === "undefined" || error.code === code)
  )
}

export function createStorefrontContentApplication(
  repository: StorefrontContentRepository
): StorefrontContentApplication {
  return {
    async listPublishedEntries(input = {}) {
      return repository.listPublishedEntries({
        siteId: optionalText(input.siteId),
        contentType: optionalText(input.contentType),
        topic: optionalText(input.topic),
        tag: optionalText(input.tag),
        limit: optionalLimit(input.limit),
      })
    },

    async getPublishedEntryBySlug(input) {
      return repository.retrievePublishedEntryBySlug({
        slug: requiredText(input.slug, "content slug"),
        siteId: optionalText(input.siteId),
      })
    },

    async getPublishedSeoDocument(input) {
      const document = await repository.retrieveSeoDocument({
        entityType: requiredText(input.entityType, "seo entity type"),
        entityId: requiredText(input.entityId, "seo entity id"),
        siteId: optionalText(input.siteId),
        language: optionalText(input.language),
      })

      return document && String(document.status) === "published" ? document : null
    },
  }
}

function optionalText(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return undefined
  }

  const text = String(value).trim()

  return text || undefined
}

function requiredText(value: unknown, label: string) {
  const text = optionalText(value)

  if (!text) {
    throw new ContentApplicationError(
      "invalid_request",
      `${label} is required`
    )
  }

  return text
}

function optionalLimit(value: StorefrontContentEntryListInput["limit"]) {
  if (value === null || typeof value === "undefined") {
    return undefined
  }

  const numberValue =
    typeof value === "number" ? value : Number.parseInt(String(value), 10)

  if (!Number.isFinite(numberValue) || numberValue < 1) {
    return undefined
  }

  return Math.min(Math.floor(numberValue), 200)
}
