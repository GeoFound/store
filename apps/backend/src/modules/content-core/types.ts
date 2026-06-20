import type { BackendRuntimeContext } from "../../platform/backend-context"

export type ContentEntryStatus = "draft" | "review" | "published" | "archived"

export type ContentFormat = "plain_text" | "markdown" | "html" | "portable_json"

export type ContentEntryType =
  | "article"
  | "guide"
  | "report"
  | "review"
  | "resource"
  | "case_study"

export type ContentEntryListInput = {
  siteId?: string | null
  status?: ContentEntryStatus | string
  contentType?: ContentEntryType | string
  topic?: string | null
  tag?: string | null
  limit?: number
}

export type CreateContentEntryInput = {
  siteId?: string | null
  slug: string
  title: string
  excerpt?: string | null
  body?: string | null
  contentFormat?: ContentFormat
  contentType?: ContentEntryType
  status?: ContentEntryStatus
  authorName?: string | null
  canonicalRevisionId?: string | null
  coverAssetId?: string | null
  coverImageUrl?: string | null
  audioAssetId?: string | null
  language?: string | null
  topic?: string | null
  tags?: string[] | string | null
  seo?: Record<string, unknown> | null
  sourceRefs?: unknown[] | Record<string, unknown> | null
  relatedProductHandles?: string[] | string | null
  aiAssisted?: boolean
  publishedAt?: string | Date | null
  metadata?: Record<string, unknown> | null
}

export type UpdateContentEntryInput = Partial<
  Omit<CreateContentEntryInput, "slug" | "title">
> & {
    id: string
    slug?: string
    title?: string
  }

export type ContentRevisionStatus =
  | "draft"
  | "review"
  | "published"
  | "superseded"
  | "archived"

export type CreateContentRevisionInput = {
  entryId: string
  siteId?: string | null
  title?: string | null
  excerpt?: string | null
  body?: string | null
  contentFormat?: ContentFormat
  status?: ContentRevisionStatus
  authorName?: string | null
  editorName?: string | null
  language?: string | null
  seo?: Record<string, unknown> | null
  sourceRefs?: unknown[] | Record<string, unknown> | null
  aiTaskRunId?: string | null
  changeNote?: string | null
  metadata?: Record<string, unknown> | null
}

export type PublishContentRevisionInput = {
  revisionId: string
  publishedAt?: string | Date | null
  channel?: ContentPublicationChannel
  metadata?: Record<string, unknown> | null
}

export type ContentAssetType =
  | "cover_image"
  | "inline_image"
  | "audio"
  | "attachment"
  | "transcript"
  | "source"

export type ContentStorageProviderKind = "local" | "s3" | "r2" | "external"

export type CreateContentAssetInput = {
  siteId?: string | null
  entryId?: string | null
  revisionId?: string | null
  assetType?: ContentAssetType
  storageProvider?: ContentStorageProviderKind
  storageProviderCode?: string | null
  bucket?: string | null
  objectKey?: string | null
  publicUrl?: string | null
  mimeType?: string | null
  byteSize?: number | null
  checksum?: string | null
  width?: number | null
  height?: number | null
  durationSeconds?: number | null
  altText?: string | null
  caption?: string | null
  metadata?: Record<string, unknown> | null
}

export type CreateContentUploadPolicyInput = {
  siteId?: string | null
  entryId?: string | null
  assetType?: ContentAssetType
  storageProviderCode?: string | null
  filename?: string | null
  mimeType?: string | null
  expiresInSeconds?: number | null
}

export type ContentPublicationChannel =
  | "storefront"
  | "rss"
  | "sitemap"
  | "api"
  | "social"

export type ContentAITaskType =
  | "article_outline"
  | "article_draft"
  | "article_rewrite"
  | "seo"
  | "summary"
  | "readability"
  | "fact_check"
  | "translation"
  | "tts"
  | "stt"
  | "custom"

export type ContentAITaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled"
  | "requires_review"

export type ContentAIReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "needs_changes"
  | "not_required"

export type CreateContentAITaskRunInput = {
  siteId?: string | null
  entryId?: string | null
  revisionId?: string | null
  taskType: ContentAITaskType
  providerCode?: string | null
  providerProtocol?: string | null
  providerCapability?: string | null
  model?: string | null
  status?: ContentAITaskStatus
  reviewStatus?: ContentAIReviewStatus
  inputSummary?: string | null
  outputSummary?: string | null
  input?: Record<string, unknown> | null
  output?: Record<string, unknown> | null
  sourceRefs?: unknown[] | Record<string, unknown> | null
  artifactRefs?: unknown[] | Record<string, unknown> | null
  errorMessage?: string | null
  startedAt?: string | Date | null
  completedAt?: string | Date | null
  metadata?: Record<string, unknown> | null
}

export type UpdateContentAITaskRunInput = Partial<CreateContentAITaskRunInput> & {
  id: string
}

export type RunContentAITaskInput = {
  /** Request/container scope used to resolve the AI runtime for execution. */
  scope: BackendRuntimeContext
  siteId?: string | null
  entryId?: string | null
  revisionId?: string | null
  taskType: ContentAITaskType
  providerCode?: string | null
  model?: string | null
  inputSummary?: string | null
  input?: Record<string, unknown> | null
  sourceRefs?: unknown[] | Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

export type CreateContentAudioInput = {
  siteId?: string | null
  entryId: string
  revisionId?: string | null
  assetId?: string | null
  status?: "queued" | "processing" | "ready" | "failed" | "archived"
  providerCode?: string | null
  model?: string | null
  voice?: string | null
  language?: string | null
  transcript?: string | null
  durationSeconds?: number | null
  errorMessage?: string | null
  metadata?: Record<string, unknown> | null
}
