import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveMarketingEngineService } from "../../../../platform/services"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("marketing-engine")) {
    res.status(503).json({
      message: "Marketing engine plugin is disabled",
    })
    return
  }

  const marketing = resolveMarketingEngineService(req.scope)
  const query = (req.validatedQuery || req.query) as {
    limit?: number
  }
  const now = Date.now()

  const campaigns = await marketing.listCampaignsSafe({
    status: "active",
    limit:
      typeof query.limit === "number" && Number.isFinite(query.limit)
        ? query.limit
        : 50,
  })

  res.json({
    campaigns: campaigns.filter((campaign) => {
      if (campaign.starts_at && new Date(campaign.starts_at).getTime() > now) {
        return false
      }

      if (campaign.ends_at && new Date(campaign.ends_at).getTime() <= now) {
        return false
      }

      return true
    }),
  })
}
