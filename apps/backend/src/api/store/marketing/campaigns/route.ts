import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveStorefrontMarketingApplication } from "../../../../platform-adapters/marketing-application"
import { localizedError } from "../../../../utils/localized-response"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("marketing-engine")) {
    localizedError(req, res, 503, "marketing.disabled")
    return
  }

  const marketing = resolveStorefrontMarketingApplication(req.scope)
  const query = (req.validatedQuery || req.query) as {
    limit?: number | string
  }
  const campaigns = await marketing.listPublicCampaigns({
    limit: query.limit,
  })

  res.json({ campaigns })
}
