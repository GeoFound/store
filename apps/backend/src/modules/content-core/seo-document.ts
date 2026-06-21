import {
  DEFAULT_SITE_ID,
  normalizeAIReviewStatus,
  normalizeJsonLike,
  normalizeLimit,
  normalizeRecord,
  normalizeSeoEntityType,
  normalizeSeoLanguage,
  normalizeSeoSource,
  normalizeSeoStatus,
  normalizeSiteId,
  normalizeStringArray,
  requireText,
  toNullableText,
} from "./service-helpers"
import type {
  ContentSeoDocumentListInput,
  RetrieveContentSeoDocumentInput,
  UpsertContentSeoDocumentInput,
} from "./types"

/**
 * Orchestration for the canonical content_seo_document records. Kept out of the
 * module service so the service stays focused; the service exposes thin
 * delegating wrappers. The repo argument is the MedusaService instance, which
 * provides the generated CRUD methods used here.
 */
export type SeoDocumentRepo = {
  listContentSeoDocuments(
    filter: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<Array<Record<string, unknown>>>
  createContentSeoDocuments(data: Record<string, unknown>): Promise<unknown>
  updateContentSeoDocuments(data: Record<string, unknown>): Promise<unknown>
}

function buildSeoDocumentFields(input: UpsertContentSeoDocumentInput) {
  const status = normalizeSeoStatus(input.status, "draft")
  return {
    meta_title: toNullableText(input.metaTitle),
    meta_description: toNullableText(input.metaDescription),
    canonical_url: toNullableText(input.canonicalUrl),
    slug: toNullableText(input.slug),
    robots_json: normalizeRecord(input.robots),
    og_title: toNullableText(input.ogTitle),
    og_description: toNullableText(input.ogDescription),
    og_image_url: toNullableText(input.ogImageUrl),
    keywords_json: normalizeStringArray(input.keywords),
    schema_type: toNullableText(input.schemaType),
    schema_json: normalizeRecord(input.schema),
    summary_tldr: toNullableText(input.summaryTldr),
    faq_json: normalizeJsonLike(input.faq),
    key_facts_json: normalizeStringArray(input.keyFacts),
    entities_json: normalizeJsonLike(input.entities),
    answer_target: toNullableText(input.answerTarget),
    status,
    review_status: normalizeAIReviewStatus(
      input.reviewStatus,
      status === "review" ? "pending" : "not_required"
    ),
    source: normalizeSeoSource(input.source, "human"),
    ai_task_run_id: toNullableText(input.aiTaskRunId),
    metadata_json: normalizeRecord(input.metadata),
  }
}

export async function upsertContentSeoDocument(
  repo: SeoDocumentRepo,
  input: UpsertContentSeoDocumentInput
) {
  const entityType = normalizeSeoEntityType(input.entityType, "page")
  const entityId = requireText(input.entityId, "seo entity id")
  const siteId = normalizeSiteId(input.siteId)
  const language = normalizeSeoLanguage(input.language)
  const fields = buildSeoDocumentFields(input)

  const [existing] = await repo.listContentSeoDocuments(
    {
      entity_type: entityType,
      entity_id: entityId,
      site_id: siteId,
      language,
    },
    { take: 1 }
  )

  if (existing) {
    return repo.updateContentSeoDocuments({
      id: String(existing.id),
      ...fields,
      version: Number(existing.version || 1) + 1,
    })
  }

  return repo.createContentSeoDocuments({
    entity_type: entityType,
    entity_id: entityId,
    site_id: siteId,
    language,
    version: 1,
    schema_version: 1,
    ...fields,
  })
}

export async function retrieveContentSeoDocument(
  repo: SeoDocumentRepo,
  input: RetrieveContentSeoDocumentInput
) {
  const entityType = normalizeSeoEntityType(input.entityType, "page")
  const entityId = requireText(input.entityId, "seo entity id")
  const siteId = normalizeSiteId(input.siteId)
  const language = normalizeSeoLanguage(input.language)
  const docs = await repo.listContentSeoDocuments(
    {
      entity_type: entityType,
      entity_id: entityId,
      site_id: [siteId, DEFAULT_SITE_ID],
      language: [language, "*"],
    },
    { take: 8 }
  )

  if (!docs.length) {
    return null
  }

  // Prefer the most specific match: exact site, then exact language.
  const score = (doc: Record<string, unknown>) =>
    (String(doc.site_id) === siteId ? 2 : 0) +
    (language !== "*" && String(doc.language) === language ? 1 : 0)

  return docs.slice().sort((left, right) => score(right) - score(left))[0]
}

export async function listContentSeoDocumentsFor(
  repo: SeoDocumentRepo,
  input?: ContentSeoDocumentListInput
) {
  return repo.listContentSeoDocuments(
    {
      ...(input?.entityType
        ? { entity_type: normalizeSeoEntityType(input.entityType, "page") }
        : {}),
      ...(input?.entityId ? { entity_id: String(input.entityId) } : {}),
      ...(input?.siteId ? { site_id: normalizeSiteId(input.siteId) } : {}),
      ...(input?.language
        ? { language: normalizeSeoLanguage(input.language) }
        : {}),
      ...(input?.status
        ? { status: normalizeSeoStatus(input.status, "draft") }
        : {}),
    },
    {
      take: normalizeLimit(input?.limit, 100),
      order: {
        updated_at: "DESC",
      },
    }
  )
}
