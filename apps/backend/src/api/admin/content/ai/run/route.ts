import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../../platform/runtime"
import { resolveContentCoreService } from "../../../../../platform-adapters/services"
import { localizedError } from "../../../../../utils/localized-response"

type RunContentAITaskBody = {
  site_id?: string | null
  entry_id?: string | null
  revision_id?: string | null
  task_type:
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
  provider_code?: string | null
  model?: string | null
  input_summary?: string | null
  input?: Record<string, unknown> | null
  source_refs?: unknown[] | Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

export const POST = async (
  req: MedusaRequest<RunContentAITaskBody>,
  res: MedusaResponse
) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const body = (req.validatedBody || req.body) as RunContentAITaskBody
  const content = resolveContentCoreService(req.scope)
  const task = await content.runAITaskSafe({
    scope: req.scope,
    siteId: body.site_id,
    entryId: body.entry_id,
    revisionId: body.revision_id,
    taskType: body.task_type,
    providerCode: body.provider_code,
    model: body.model,
    inputSummary: body.input_summary,
    input: body.input,
    sourceRefs: body.source_refs,
    metadata: body.metadata,
  })

  res.status(201).json({
    task,
  })
}
