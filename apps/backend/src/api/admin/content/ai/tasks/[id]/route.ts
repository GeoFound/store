import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../../../platform/runtime"
import { resolveContentCoreService } from "../../../../../../platform-adapters/services"
import { localizedError } from "../../../../../../utils/localized-response"

type UpdateContentAITaskRunBody = {
  site_id?: string | null
  entry_id?: string | null
  revision_id?: string | null
  task_type?:
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
  provider_protocol?: string | null
  provider_capability?: string | null
  model?: string | null
  status?: "queued" | "running" | "succeeded" | "failed" | "canceled" | "requires_review"
  review_status?: "pending" | "approved" | "rejected" | "needs_changes" | "not_required"
  input_summary?: string | null
  output_summary?: string | null
  input?: Record<string, unknown> | null
  output?: Record<string, unknown> | null
  source_refs?: unknown[] | Record<string, unknown> | null
  artifact_refs?: unknown[] | Record<string, unknown> | null
  error_message?: string | null
  started_at?: string | null
  completed_at?: string | null
  metadata?: Record<string, unknown> | null
}

export const POST = async (
  req: MedusaRequest<UpdateContentAITaskRunBody>,
  res: MedusaResponse
) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const body = (req.validatedBody || req.body) as UpdateContentAITaskRunBody
  const content = resolveContentCoreService(req.scope)
  const task = await content.updateAITaskRunSafe({
    id: String(req.params.id),
    siteId: body.site_id,
    entryId: body.entry_id,
    revisionId: body.revision_id,
    taskType: body.task_type,
    providerCode: body.provider_code,
    providerProtocol: body.provider_protocol,
    providerCapability: body.provider_capability,
    model: body.model,
    status: body.status,
    reviewStatus: body.review_status,
    inputSummary: body.input_summary,
    outputSummary: body.output_summary,
    input: body.input,
    output: body.output,
    sourceRefs: body.source_refs,
    artifactRefs: body.artifact_refs,
    errorMessage: body.error_message,
    startedAt: body.started_at,
    completedAt: body.completed_at,
    metadata: body.metadata,
  })

  res.json({
    task,
  })
}
