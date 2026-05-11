import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_ENGINE_MODULE } from "../../../../modules/marketing-engine"
import type MarketingEngineModuleService from "../../../../modules/marketing-engine/service"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const marketing: MarketingEngineModuleService = req.scope.resolve(
    MARKETING_ENGINE_MODULE
  )
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
