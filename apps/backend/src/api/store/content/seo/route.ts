import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveContentCoreService } from "../../../../platform-adapters/services"
import { localizedError } from "../../../../utils/localized-response"

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
  }

  if (!query.entity_type || !query.entity_id) {
    res.status(400).json({
      message: "entity_type and entity_id are required",
    })
    return
  }

  const content = resolveContentCoreService(req.scope)
  const document = await content.retrieveContentSeoDocumentSafe({
    entityType: query.entity_type as never,
    entityId: query.entity_id,
    siteId: query.site_id,
    language: query.language,
  })

  // The storefront only ever consumes published discoverability documents.
  const seo =
    document && String(document.status) === "published" ? document : null

  res.json({
    seo,
  })
}
