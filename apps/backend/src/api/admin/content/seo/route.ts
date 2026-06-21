import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveContentCoreService } from "../../../../platform-adapters/services"
import { localizedError } from "../../../../utils/localized-response"

type UpsertContentSeoDocumentBody = {
  entity_type: "product" | "content_entry" | "collection" | "page" | "site"
  entity_id: string
  site_id?: string | null
  language?: string | null
  meta_title?: string | null
  meta_description?: string | null
  canonical_url?: string | null
  slug?: string | null
  robots?: Record<string, unknown> | null
  og_title?: string | null
  og_description?: string | null
  og_image_url?: string | null
  keywords?: string[] | string | null
  schema_type?: string | null
  schema?: Record<string, unknown> | null
  summary_tldr?: string | null
  faq?: unknown[] | Record<string, unknown> | null
  key_facts?: string[] | string | null
  entities?: unknown[] | Record<string, unknown> | null
  answer_target?: string | null
  status?: "draft" | "review" | "published" | "archived"
  review_status?: "pending" | "approved" | "rejected" | "needs_changes" | "not_required"
  source?: "human" | "ai" | "mixed"
  ai_task_run_id?: string | null
  metadata?: Record<string, unknown> | null
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const query = (req.validatedQuery || req.query) as {
    entity_type?: string
    entity_id?: string
    site_id?: string
    language?: string
    status?: string
    limit?: number
  }
  const content = resolveContentCoreService(req.scope)
  const documents = await content.listContentSeoDocumentsSafe({
    entityType: query.entity_type,
    entityId: query.entity_id,
    siteId: query.site_id,
    language: query.language,
    status: query.status,
    limit: query.limit,
  })

  res.json({
    documents,
  })
}

export const POST = async (
  req: MedusaRequest<UpsertContentSeoDocumentBody>,
  res: MedusaResponse
) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const body = (req.validatedBody || req.body) as UpsertContentSeoDocumentBody
  const content = resolveContentCoreService(req.scope)
  const document = await content.upsertContentSeoDocumentSafe({
    entityType: body.entity_type,
    entityId: body.entity_id,
    siteId: body.site_id,
    language: body.language,
    metaTitle: body.meta_title,
    metaDescription: body.meta_description,
    canonicalUrl: body.canonical_url,
    slug: body.slug,
    robots: body.robots,
    ogTitle: body.og_title,
    ogDescription: body.og_description,
    ogImageUrl: body.og_image_url,
    keywords: body.keywords,
    schemaType: body.schema_type,
    schema: body.schema,
    summaryTldr: body.summary_tldr,
    faq: body.faq,
    keyFacts: body.key_facts,
    entities: body.entities,
    answerTarget: body.answer_target,
    status: body.status,
    reviewStatus: body.review_status,
    source: body.source,
    aiTaskRunId: body.ai_task_run_id,
    metadata: body.metadata,
  })

  res.status(201).json({
    document,
  })
}
