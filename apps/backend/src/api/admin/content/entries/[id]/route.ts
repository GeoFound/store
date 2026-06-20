import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../../platform/runtime"
import { resolveContentCoreService } from "../../../../../platform-adapters/services"
import { localizedError } from "../../../../../utils/localized-response"

type ContentEntryStatus = "draft" | "review" | "published" | "archived"
type ContentEntryType =
  | "article"
  | "guide"
  | "report"
  | "review"
  | "resource"
  | "case_study"

type UpdateContentEntryBody = {
  site_id?: string | null
  slug?: string
  title?: string
  excerpt?: string | null
  body?: string | null
  content_format?: "plain_text" | "markdown" | "html" | "portable_json"
  content_type?: ContentEntryType
  status?: ContentEntryStatus
  author_name?: string | null
  canonical_revision_id?: string | null
  cover_asset_id?: string | null
  cover_image_url?: string | null
  audio_asset_id?: string | null
  language?: string | null
  topic?: string | null
  tags?: string[] | string | null
  seo?: Record<string, unknown> | null
  source_refs?: unknown[] | Record<string, unknown> | null
  related_product_handles?: string[] | string | null
  ai_assisted?: boolean
  published_at?: string | null
  metadata?: Record<string, unknown> | null
}

export const POST = async (
  req: MedusaRequest<UpdateContentEntryBody>,
  res: MedusaResponse
) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const body = (req.validatedBody || req.body) as UpdateContentEntryBody
  const content = resolveContentCoreService(req.scope)
  const entry = await content.updateEntrySafe({
    id: String(req.params.id),
    siteId: body.site_id,
    slug: body.slug,
    title: body.title,
    excerpt: body.excerpt,
    body: body.body,
    contentFormat: body.content_format,
    contentType: body.content_type,
    status: body.status,
    authorName: body.author_name,
    canonicalRevisionId: body.canonical_revision_id,
    coverAssetId: body.cover_asset_id,
    coverImageUrl: body.cover_image_url,
    audioAssetId: body.audio_asset_id,
    language: body.language,
    topic: body.topic,
    tags: body.tags,
    seo: body.seo,
    sourceRefs: body.source_refs,
    relatedProductHandles: body.related_product_handles,
    aiAssisted: body.ai_assisted,
    publishedAt: body.published_at,
    metadata: body.metadata,
  })

  res.json({
    entry,
  })
}
