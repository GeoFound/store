import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  isContentApplicationError,
  type StorefrontSeoDocument,
} from "../../../../application/content"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveStorefrontContentApplication } from "../../../../platform-adapters/content-application"
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

  const content = resolveStorefrontContentApplication(req.scope)
  let seo: StorefrontSeoDocument | null = null

  try {
    seo = await content.getPublishedSeoDocument({
      entityType: query.entity_type,
      entityId: query.entity_id,
      siteId: query.site_id,
      language: query.language,
    })
  } catch (error) {
    if (isContentApplicationError(error, "invalid_request")) {
      res.status(400).json({
        message: "entity_type and entity_id are required",
      })
      return
    }

    throw error
  }

  res.json({
    seo,
  })
}
