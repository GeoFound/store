import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveContentCoreService } from "../../../../platform-adapters/services"
import { localizedError } from "../../../../utils/localized-response"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const content = resolveContentCoreService(req.scope)
  const query = (req.validatedQuery || req.query) as {
    site_id?: string
    content_type?: string
    topic?: string
    tag?: string
    limit?: number
  }

  const entries = await content.listPublishedEntriesSafe({
    siteId: query.site_id,
    contentType: query.content_type,
    topic: query.topic,
    tag: query.tag,
    limit: query.limit,
  })

  res.json({
    entries,
  })
}
