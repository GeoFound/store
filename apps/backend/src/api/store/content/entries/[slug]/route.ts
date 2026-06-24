import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../../platform/runtime"
import { resolveStorefrontContentApplication } from "../../../../../platform-adapters/content-application"
import { localizedError } from "../../../../../utils/localized-response"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const content = resolveStorefrontContentApplication(req.scope)
  const query = (req.validatedQuery || req.query) as {
    site_id?: string
  }
  const entry = await content.getPublishedEntryBySlug({
    slug: String(req.params.slug),
    siteId: query.site_id,
  })

  if (!entry) {
    res.status(404).json({
      message: "Content entry was not found",
    })
    return
  }

  res.json({
    entry,
  })
}
