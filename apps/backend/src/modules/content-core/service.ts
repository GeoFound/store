import {
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"
import type { Context } from "@medusajs/framework/types"
import { runAITaskPlugin } from "../../platform/ai"
import ContentAITaskRun from "./models/content-ai-task-run"
import ContentAsset from "./models/content-asset"
import ContentAudio from "./models/content-audio"
import ContentEntry from "./models/content-entry"
import ContentPublication from "./models/content-publication"
import ContentRevision from "./models/content-revision"
import { createContentUploadPolicy, getContentStorageRuntimeConfig } from "./storage"
import {
  DEFAULT_SITE_ID,
  buildCreateAssetRecord,
  buildPatch,
  checksumText,
  attachPublicAssetsForEntries,
  filterByTag,
  getReadabilitySnapshot,
  getReadingStats,
  normalizeAIReviewStatus,
  normalizeAITaskStatus,
  normalizeAITaskType,
  normalizeContentFormat,
  normalizeContentType,
  normalizeJsonLike,
  normalizeLanguage,
  normalizeLimit,
  normalizeNullableNumber,
  normalizePublicationChannel,
  normalizeRecord,
  normalizeRevisionStatus,
  normalizeSiteId,
  normalizeSlug,
  normalizeStatus,
  normalizeStringArray,
  type PatchField,
  requireText,
  resolveOptionalDate,
  resolvePublishedAt,
  resolveVisibleSiteIds,
  toNullableText,
  toRecordList,
} from "./service-helpers"
import type {
  ContentEntryListInput,
  ContentEntryStatus,
  ContentFormat,
  CreateContentAITaskRunInput,
  CreateContentAssetInput,
  CreateContentAudioInput,
  CreateContentEntryInput,
  CreateContentRevisionInput,
  CreateContentUploadPolicyInput,
  PublishContentRevisionInput,
  RunContentAITaskInput,
  UpdateContentAITaskRunInput,
  UpdateContentEntryInput,
} from "./types"

const ENTRY_PATCH_FIELDS: Array<PatchField<UpdateContentEntryInput>> = [
  { key: "title", column: "title", map: (value) => requireText(value, "content title") },
  { key: "excerpt", column: "excerpt", map: toNullableText },
  {
    key: "contentFormat",
    column: "content_format",
    map: (value) => normalizeContentFormat(value, "plain_text"),
  },
  {
    key: "contentType",
    column: "content_type",
    map: (value) => normalizeContentType(value, "article"),
  },
  { key: "authorName", column: "author_name", map: toNullableText },
  { key: "canonicalRevisionId", column: "canonical_revision_id", map: toNullableText },
  { key: "coverAssetId", column: "cover_asset_id", map: toNullableText },
  { key: "coverImageUrl", column: "cover_image_url", map: toNullableText },
  { key: "audioAssetId", column: "audio_asset_id", map: toNullableText },
  { key: "language", column: "language", map: normalizeLanguage },
  { key: "topic", column: "topic", map: toNullableText },
  { key: "tags", column: "tags_json", map: normalizeStringArray },
  { key: "seo", column: "seo_json", map: normalizeRecord },
  { key: "sourceRefs", column: "source_refs_json", map: normalizeJsonLike },
  {
    key: "relatedProductHandles",
    column: "related_product_handles_json",
    map: normalizeStringArray,
  },
  { key: "aiAssisted", column: "ai_assisted", map: (value) => Boolean(value) },
  { key: "metadata", column: "metadata_json", map: normalizeRecord },
]

const AI_TASK_RUN_PATCH_FIELDS: Array<PatchField<UpdateContentAITaskRunInput>> = [
  { key: "siteId", column: "site_id", map: normalizeSiteId },
  { key: "entryId", column: "entry_id", map: toNullableText },
  { key: "revisionId", column: "revision_id", map: toNullableText },
  {
    key: "taskType",
    column: "task_type",
    map: (value) => normalizeAITaskType(value, "custom"),
  },
  { key: "providerCode", column: "provider_code", map: toNullableText },
  { key: "providerProtocol", column: "provider_protocol", map: toNullableText },
  { key: "providerCapability", column: "provider_capability", map: toNullableText },
  { key: "model", column: "model", map: toNullableText },
  {
    key: "status",
    column: "status",
    map: (value) => normalizeAITaskStatus(value, "queued"),
  },
  {
    key: "reviewStatus",
    column: "review_status",
    map: (value) => normalizeAIReviewStatus(value, "pending"),
  },
  { key: "inputSummary", column: "input_summary", map: toNullableText },
  { key: "outputSummary", column: "output_summary", map: toNullableText },
  { key: "input", column: "input_json", map: normalizeRecord },
  { key: "output", column: "output_json", map: normalizeRecord },
  { key: "sourceRefs", column: "source_refs_json", map: normalizeJsonLike },
  { key: "artifactRefs", column: "artifact_refs_json", map: normalizeJsonLike },
  { key: "errorMessage", column: "error_message", map: toNullableText },
  {
    key: "startedAt",
    column: "started_at",
    map: (value) => resolveOptionalDate(value as string | Date | null | undefined),
  },
  {
    key: "completedAt",
    column: "completed_at",
    map: (value) => resolveOptionalDate(value as string | Date | null | undefined),
  },
  { key: "metadata", column: "metadata_json", map: normalizeRecord },
]

class ContentCoreModuleService extends MedusaService({
  ContentAITaskRun,
  ContentAsset,
  ContentAudio,
  ContentEntry,
  ContentPublication,
  ContentRevision,
}) {
  async createEntrySafe(input: CreateContentEntryInput) {
    const siteId = normalizeSiteId(input.siteId)
    const slug = normalizeSlug(input.slug)

    await this.assertSlugIsUnique(siteId, slug)

    const status = normalizeStatus(input.status, "draft")
    const publishedAt = resolvePublishedAt(status, input.publishedAt)
    const body = toNullableText(input.body)
    const readingStats = getReadingStats(body)

    return this.createContentEntries({
      site_id: siteId,
      slug,
      title: requireText(input.title, "content title"),
      excerpt: toNullableText(input.excerpt),
      body,
      content_format: normalizeContentFormat(input.contentFormat, "plain_text"),
      content_type: normalizeContentType(input.contentType, "article"),
      status,
      author_name: toNullableText(input.authorName),
      canonical_revision_id: toNullableText(input.canonicalRevisionId),
      cover_asset_id: toNullableText(input.coverAssetId),
      cover_image_url: toNullableText(input.coverImageUrl),
      audio_asset_id: toNullableText(input.audioAssetId),
      language: normalizeLanguage(input.language),
      reading_time_minutes: readingStats.readingTimeMinutes,
      word_count: readingStats.wordCount,
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

    const body =
      typeof input.body === "undefined" ? existing.body : toNullableText(input.body)
    const readingStats = getReadingStats(body)

    return this.updateContentEntries({
      id,
      site_id: nextSiteId,
      slug: nextSlug,
      status: nextStatus,
      published_at: publishedAt,
      word_count: readingStats.wordCount,
      reading_time_minutes: readingStats.readingTimeMinutes,
      ...(typeof input.body === "undefined" ? {} : { body }),
      ...buildPatch(input, ENTRY_PATCH_FIELDS),
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

  async listPublishedEntriesWithAssetsSafe(
    input?: Omit<ContentEntryListInput, "status">
  ) {
    const entries = await this.listPublishedEntriesSafe(input)

    return this.attachPublicAssets(entries)
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

  async retrievePublishedEntryBySlugWithAssetsSafe(input: {
    slug: string
    siteId?: string | null
  }) {
    const entry = await this.retrievePublishedEntryBySlugSafe(input)

    if (!entry) {
      return null
    }

    const [enriched] = await this.attachPublicAssets([entry])

    return enriched || entry
  }

  listStorageProvidersSafe() {
    return getContentStorageRuntimeConfig()
  }

  createUploadPolicySafe(input: CreateContentUploadPolicyInput) {
    return createContentUploadPolicy({
      providerCode: input.storageProviderCode,
      assetType: input.assetType,
      entryId: input.entryId,
      filename: input.filename,
      mimeType: input.mimeType,
      siteId: input.siteId,
      expiresInSeconds: input.expiresInSeconds,
    })
  }

  async createRevisionSafe(input: CreateContentRevisionInput) {
    const entry = await this.retrieveContentEntry(
      requireText(input.entryId, "content entry id")
    )
    const body =
      typeof input.body === "undefined" ? toNullableText(entry.body) : toNullableText(input.body)
    const readingStats = getReadingStats(body)
    const revisions = await this.listContentRevisions(
      {
        entry_id: String(entry.id),
      },
      {
        take: 200,
        order: {
          revision_number: "DESC",
        },
      }
    )
    const nextRevisionNumber =
      revisions.reduce(
        (max, revision) =>
          Math.max(max, Number(revision.revision_number || 0)),
        0
      ) + 1

    return this.createContentRevisions({
      entry_id: String(entry.id),
      site_id:
        typeof input.siteId === "undefined"
          ? String(entry.site_id || DEFAULT_SITE_ID)
          : normalizeSiteId(input.siteId),
      revision_number: nextRevisionNumber,
      title:
        typeof input.title === "undefined" || input.title === null
          ? String(entry.title)
          : requireText(input.title, "content title"),
      excerpt:
        typeof input.excerpt === "undefined"
          ? toNullableText(entry.excerpt)
          : toNullableText(input.excerpt),
      body,
      content_format: normalizeContentFormat(
        input.contentFormat,
        (entry.content_format as ContentFormat) || "plain_text"
      ),
      status: normalizeRevisionStatus(input.status, "draft"),
      author_name:
        typeof input.authorName === "undefined"
          ? toNullableText(entry.author_name)
          : toNullableText(input.authorName),
      editor_name: toNullableText(input.editorName),
      language:
        typeof input.language === "undefined"
          ? normalizeLanguage(entry.language)
          : normalizeLanguage(input.language),
      word_count: readingStats.wordCount,
      reading_time_minutes: readingStats.readingTimeMinutes,
      seo_json:
        typeof input.seo === "undefined"
          ? normalizeRecord(entry.seo_json)
          : normalizeRecord(input.seo),
      source_refs_json:
        typeof input.sourceRefs === "undefined"
          ? normalizeJsonLike(entry.source_refs_json)
          : normalizeJsonLike(input.sourceRefs),
      readability_json: getReadabilitySnapshot(body),
      ai_task_run_id: toNullableText(input.aiTaskRunId),
      checksum: checksumText(
        [
          input.title || entry.title,
          input.excerpt || entry.excerpt || "",
          body || "",
        ].join("\n\n")
      ),
      change_note: toNullableText(input.changeNote),
      metadata_json: normalizeRecord(input.metadata),
    } as any)
  }

  @InjectTransactionManager()
  async publishRevisionSafe(
    input: PublishContentRevisionInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const revision = await this.retrieveContentRevision(
      requireText(input.revisionId, "content revision id"),
      {},
      sharedContext
    )
    const publishedAt = resolvePublishedAt("published", input.publishedAt)
    const body = toNullableText(revision.body)
    const readingStats = getReadingStats(body)

    await this.updateContentEntries(
      {
        id: String(revision.entry_id),
        site_id: normalizeSiteId(revision.site_id),
        title: requireText(revision.title, "content title"),
        excerpt: toNullableText(revision.excerpt),
        body,
        content_format: normalizeContentFormat(
          revision.content_format,
          "plain_text"
        ),
        status: "published",
        author_name: toNullableText(revision.author_name),
        canonical_revision_id: String(revision.id),
        language: normalizeLanguage(revision.language),
        word_count: readingStats.wordCount,
        reading_time_minutes: readingStats.readingTimeMinutes,
        seo_json: normalizeRecord(revision.seo_json),
        source_refs_json: normalizeJsonLike(revision.source_refs_json),
        published_at: publishedAt,
      } as any,
      sharedContext
    )

    await this.updateContentRevisions(
      {
        id: String(revision.id),
        status: "published",
      } as any,
      sharedContext
    )

    const publication = await this.createContentPublications(
      {
        site_id: normalizeSiteId(revision.site_id),
        entry_id: String(revision.entry_id),
        revision_id: String(revision.id),
        channel: normalizePublicationChannel(input.channel, "storefront"),
        status: "published",
        publish_at: publishedAt,
        published_at: publishedAt,
        metadata_json: normalizeRecord(input.metadata),
      } as any,
      sharedContext
    )

    return {
      entry: await this.retrieveContentEntry(
        String(revision.entry_id),
        {},
        sharedContext
      ),
      revision,
      publication,
    }
  }

  async createAssetSafe(input: CreateContentAssetInput) {
    return this.createContentAssets(buildCreateAssetRecord(input) as any)
  }

  async createAudioSafe(input: CreateContentAudioInput) {
    const siteId = normalizeSiteId(input.siteId)

    return this.createContentAudioes({
      site_id: siteId,
      entry_id: requireText(input.entryId, "content entry id"),
      revision_id: toNullableText(input.revisionId),
      asset_id: toNullableText(input.assetId),
      status:
        input.status === "processing" ||
        input.status === "ready" ||
        input.status === "failed" ||
        input.status === "archived"
          ? input.status
          : "queued",
      provider_code: toNullableText(input.providerCode),
      model: toNullableText(input.model),
      voice: toNullableText(input.voice),
      language: normalizeLanguage(input.language),
      transcript: toNullableText(input.transcript),
      duration_seconds: normalizeNullableNumber(input.durationSeconds),
      error_message: toNullableText(input.errorMessage),
      metadata_json: normalizeRecord(input.metadata),
    } as any)
  }

  async createAITaskRunSafe(input: CreateContentAITaskRunInput) {
    const status = normalizeAITaskStatus(input.status, "queued")

    return this.createContentAITaskRuns({
      site_id: normalizeSiteId(input.siteId),
      entry_id: toNullableText(input.entryId),
      revision_id: toNullableText(input.revisionId),
      task_type: normalizeAITaskType(input.taskType, "custom"),
      provider_code: toNullableText(input.providerCode),
      provider_protocol: toNullableText(input.providerProtocol),
      provider_capability: toNullableText(input.providerCapability),
      model: toNullableText(input.model),
      status,
      review_status: normalizeAIReviewStatus(
        input.reviewStatus,
        status === "requires_review" ? "pending" : "not_required"
      ),
      input_summary: toNullableText(input.inputSummary),
      output_summary: toNullableText(input.outputSummary),
      input_json: normalizeRecord(input.input),
      output_json: normalizeRecord(input.output),
      source_refs_json: normalizeJsonLike(input.sourceRefs),
      artifact_refs_json: normalizeJsonLike(input.artifactRefs),
      error_message: toNullableText(input.errorMessage),
      started_at: resolveOptionalDate(input.startedAt),
      completed_at: resolveOptionalDate(input.completedAt),
      metadata_json: normalizeRecord(input.metadata),
    } as any)
  }

  async updateAITaskRunSafe(input: UpdateContentAITaskRunInput) {
    const id = requireText(input.id, "content AI task run id")

    return this.updateContentAITaskRuns({
      id,
      ...buildPatch(input, AI_TASK_RUN_PATCH_FIELDS),
    } as any)
  }

  /**
   * Persists an AI task run, executes the matching registered task plugin
   * (which calls the AI runtime), and records the outcome. This is the single
   * orchestrator that connects the content-core run ledger to the ai-core
   * invocation seam — content AI output is always left in `requires_review`.
   */
  async runAITaskSafe(input: RunContentAITaskInput) {
    const taskType = normalizeAITaskType(input.taskType, "custom")
    const siteId = normalizeSiteId(input.siteId)
    const pluginCode = `content.${taskType}`
    const payload = normalizeRecord(input.input)
    const metadata = normalizeRecord(input.metadata)

    const run = await this.createAITaskRunSafe({
      siteId,
      entryId: input.entryId,
      revisionId: input.revisionId,
      taskType,
      providerCode: input.providerCode,
      model: input.model,
      status: "running",
      inputSummary: input.inputSummary,
      input: payload,
      sourceRefs: input.sourceRefs,
      metadata: input.metadata,
      startedAt: new Date(),
    })

    const outcome = await runAITaskPlugin(pluginCode, {
      scope: input.scope,
      providerCode: input.providerCode,
      siteId,
      input: payload || undefined,
      sourceRefs: toRecordList(input.sourceRefs),
      metadata: metadata || undefined,
    })

    const result = outcome.result
    const output = normalizeRecord(result.output)
    const providerInfo = output ? normalizeRecord(output.provider) : null
    const reviewStatus =
      result.status === "requires_review" ? "pending" : "not_required"

    return this.updateAITaskRunSafe({
      id: String(run.id),
      status: result.status,
      reviewStatus,
      providerCode: providerInfo ? toNullableText(providerInfo.code) : undefined,
      providerProtocol: providerInfo
        ? toNullableText(providerInfo.protocol)
        : undefined,
      providerCapability: providerInfo
        ? toNullableText(providerInfo.capability)
        : undefined,
      model: providerInfo ? toNullableText(providerInfo.model) : undefined,
      output: result.output ?? null,
      outputSummary: result.outputSummary ?? null,
      artifactRefs: result.artifactRefs ?? null,
      errorMessage: result.errorMessage ?? null,
      completedAt: new Date(),
    })
  }

  private async assertSlugIsUnique(siteId: string, slug: string, ignoreEntryId?: string) {
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

  private async attachPublicAssets<T extends { id?: unknown }>(entries: T[]) {
    return attachPublicAssetsForEntries(this, entries)
  }
}

export default ContentCoreModuleService
