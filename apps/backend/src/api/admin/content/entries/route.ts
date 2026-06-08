import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveContentCoreService } from "../../../../platform-adapters/services"
import { localizedError } from "../../../../utils/localized-response"

type ContentEntryStatus = "draft" | "review" | "published" | "archived"
type ContentEntryType =
  | "article"
  | "guide"
  | "report"
  | "review"
  | "resource"
  | "case_study"

type CreateContentEntryBody = {
  site_id?: string | null
  slug?: string
  title?: string
  excerpt?: string | null
  body?: string | null
  content_type?: ContentEntryType
  status?: ContentEntryStatus
  author_name?: string | null
  cover_image_url?: string | null
  topic?: string | null
  tags?: string[] | string | null
  seo?: Record<string, unknown> | null
  source_refs?: unknown[] | Record<string, unknown> | null
  related_product_handles?: string[] | string | null
  ai_assisted?: boolean
  published_at?: string | null
  metadata?: Record<string, unknown> | null
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const content = resolveContentCoreService(req.scope)
  const query = (req.validatedQuery || req.query) as {
    site_id?: string
    status?: string
    content_type?: string
    topic?: string
    tag?: string
    limit?: number
  }

  const entries = await content.listEntriesSafe({
    siteId: query.site_id,
    status: query.status,
    contentType: query.content_type,
    topic: query.topic,
    tag: query.tag,
    limit: query.limit,
  })

  res.json({
    entries,
  })
}

export const POST = async (
  req: MedusaRequest<CreateContentEntryBody>,
  res: MedusaResponse
) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const body = (req.validatedBody || req.body) as CreateContentEntryBody

  if (!body.slug || !body.title) {
    localizedError(req, res, 400, "content.entryRequired")
    return
  }

  const content = resolveContentCoreService(req.scope)
  const entry = await content.createEntrySafe({
    siteId: body.site_id,
    slug: body.slug,
    title: body.title,
    excerpt: body.excerpt,
    body: body.body,
    contentType: body.content_type,
    status: body.status,
    authorName: body.author_name,
    coverImageUrl: body.cover_image_url,
    topic: body.topic,
    tags: body.tags,
    seo: body.seo,
    sourceRefs: body.source_refs,
    relatedProductHandles: body.related_product_handles,
    aiAssisted: body.ai_assisted,
    publishedAt: body.published_at,
    metadata: body.metadata,
  })

  res.status(201).json({
    entry,
  })
}
