import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveContentCoreService } from "../../../../platform-adapters/services"
import { localizedError } from "../../../../utils/localized-response"

type CreateContentAudioBody = {
  site_id?: string | null
  entry_id: string
  revision_id?: string | null
  asset_id?: string | null
  status?: "queued" | "processing" | "ready" | "failed" | "archived"
  provider_code?: string | null
  model?: string | null
  voice?: string | null
  language?: string | null
  transcript?: string | null
  duration_seconds?: number | null
  error_message?: string | null
  metadata?: Record<string, unknown> | null
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const query = (req.validatedQuery || req.query) as {
    site_id?: string
    entry_id?: string
    status?: string
    limit?: number
  }
  const content = resolveContentCoreService(req.scope)
  const audio = await content.listContentAudioes(
    {
      ...(query.site_id ? { site_id: query.site_id } : {}),
      ...(query.entry_id ? { entry_id: query.entry_id } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    {
      take: normalizeLimit(query.limit, 100),
      order: {
        created_at: "DESC",
      },
    }
  )

  res.json({ audio })
}

export const POST = async (
  req: MedusaRequest<CreateContentAudioBody>,
  res: MedusaResponse
) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const body = (req.validatedBody || req.body) as CreateContentAudioBody
  const content = resolveContentCoreService(req.scope)
  const audio = await content.createAudioSafe({
    siteId: body.site_id,
    entryId: body.entry_id,
    revisionId: body.revision_id,
    assetId: body.asset_id,
    status: body.status,
    providerCode: body.provider_code,
    model: body.model,
    voice: body.voice,
    language: body.language,
    transcript: body.transcript,
    durationSeconds: body.duration_seconds,
    errorMessage: body.error_message,
    metadata: body.metadata,
  })

  res.status(201).json({ audio })
}

function normalizeLimit(value: unknown, fallback: number) {
  const numberValue =
    typeof value === "number" ? value : Number.parseInt(String(value || ""), 10)

  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.min(Math.floor(numberValue), 200)
    : fallback
}
