import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../../../platform/runtime"
import { resolveContentCoreService } from "../../../../../../platform-adapters/services"
import { localizedError } from "../../../../../../utils/localized-response"

type PublishContentRevisionBody = {
  published_at?: string | null
  channel?: "storefront" | "rss" | "sitemap" | "api" | "social"
  metadata?: Record<string, unknown> | null
}

export const POST = async (
  req: MedusaRequest<PublishContentRevisionBody>,
  res: MedusaResponse
) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const body = (req.validatedBody || req.body) as PublishContentRevisionBody
  const content = resolveContentCoreService(req.scope)
  const result = await content.publishRevisionSafe({
    revisionId: String(req.params.id),
    publishedAt: body.published_at,
    channel: body.channel,
    metadata: body.metadata,
  })

  res.json(result)
}
