import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../../platform/runtime"
import { suggestSeoFixesForRequest } from "../../../../../platform-adapters/seo-suggest"
import { localizedError } from "../../../../../utils/localized-response"

type SuggestSeoBody = {
  entity_type: "product" | "content_entry" | "collection" | "page" | "site"
  entity_id: string
  site_id?: string | null
  language?: string | null
  provider_code?: string | null
  model?: string | null
}

export const POST = async (
  req: MedusaRequest<SuggestSeoBody>,
  res: MedusaResponse
) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const body = (req.validatedBody || req.body) as SuggestSeoBody
  const result = await suggestSeoFixesForRequest(req.scope, {
    entityType: body.entity_type,
    entityId: body.entity_id,
    siteId: body.site_id,
    language: body.language,
    providerCode: body.provider_code,
    model: body.model,
  })

  res.status(result.configured ? 201 : 200).json(result)
}
