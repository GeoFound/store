import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../../platform/runtime"
import { resolveContentCoreService } from "../../../../../platform-adapters/services"
import { localizedError } from "../../../../../utils/localized-response"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const query = (req.validatedQuery || req.query) as {
    entity_type?: string
    site_id?: string
    limit?: number
  }
  const content = resolveContentCoreService(req.scope)
  const report = await content.auditContentSeoSafe({
    entityType: query.entity_type,
    siteId: query.site_id,
    limit: query.limit,
  })

  res.json(report)
}
