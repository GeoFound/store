import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../../../platform/runtime"
import { resolveContentCoreService } from "../../../../../../platform-adapters/services"
import { localizedError } from "../../../../../../utils/localized-response"

type CreateContentRevisionBody = {
  site_id?: string | null
  title?: string | null
  excerpt?: string | null
  body?: string | null
  content_format?: "plain_text" | "markdown" | "html" | "portable_json"
  status?: "draft" | "review" | "published" | "superseded" | "archived"
  author_name?: string | null
  editor_name?: string | null
  language?: string | null
  seo?: Record<string, unknown> | null
  source_refs?: unknown[] | Record<string, unknown> | null
  ai_task_run_id?: string | null
  change_note?: string | null
  metadata?: Record<string, unknown> | null
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const query = (req.validatedQuery || req.query) as {
    limit?: number
  }
  const content = resolveContentCoreService(req.scope)
  const revisions = await content.listContentRevisions(
    {
      entry_id: String(req.params.id),
    },
    {
      take: normalizeLimit(query.limit, 50),
      order: {
        revision_number: "DESC",
        created_at: "DESC",
      },
    }
  )

  res.json({
    revisions,
  })
}

export const POST = async (
  req: MedusaRequest<CreateContentRevisionBody>,
  res: MedusaResponse
) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const body = (req.validatedBody || req.body) as CreateContentRevisionBody
  const content = resolveContentCoreService(req.scope)
  const revision = await content.createRevisionSafe({
    entryId: String(req.params.id),
    siteId: body.site_id,
    title: body.title,
    excerpt: body.excerpt,
    body: body.body,
    contentFormat: body.content_format,
    status: body.status,
    authorName: body.author_name,
    editorName: body.editor_name,
    language: body.language,
    seo: body.seo,
    sourceRefs: body.source_refs,
    aiTaskRunId: body.ai_task_run_id,
    changeNote: body.change_note,
    metadata: body.metadata,
  })

  res.status(201).json({
    revision,
  })
}

function normalizeLimit(value: unknown, fallback: number) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value || ""), 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return Math.min(Math.floor(parsed), 200)
}
