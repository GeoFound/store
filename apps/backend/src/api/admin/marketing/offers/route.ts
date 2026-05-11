import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_ENGINE_MODULE } from "../../../../modules/marketing-engine"
import type MarketingEngineModuleService from "../../../../modules/marketing-engine/service"

type CreateOfferBody = {
  campaign_id?: string | null
  code?: string
  name?: string
  type?: "coupon" | "bundle" | "referral" | "upsell" | "email_flow" | "custom"
  status?: "draft" | "active" | "paused" | "archived"
  priority?: number
  starts_at?: string | null
  ends_at?: string | null
  conditions?: Record<string, unknown> | null
  reward?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const marketing: MarketingEngineModuleService = req.scope.resolve(
    MARKETING_ENGINE_MODULE
  )
  const query = (req.validatedQuery || req.query) as {
    status?: string
    campaign_id?: string
    code?: string
    limit?: number
  }

  const offers = await marketing.listOffersSafe({
    status: query.status,
    campaignId: query.campaign_id,
    code: query.code,
    limit: query.limit,
  })

  res.json({
    offers,
  })
}

export const POST = async (
  req: MedusaRequest<CreateOfferBody>,
  res: MedusaResponse
) => {
  const body = (req.validatedBody || req.body) as CreateOfferBody

  if (!body.code || !body.name) {
    res.status(400).json({
      message: "code and name are required",
    })
    return
  }

  const marketing: MarketingEngineModuleService = req.scope.resolve(
    MARKETING_ENGINE_MODULE
  )

  const offer = await marketing.createOfferSafe({
    campaignId: body.campaign_id,
    code: body.code,
    name: body.name,
    type: body.type,
    status: body.status,
    priority: body.priority,
    startsAt: body.starts_at,
    endsAt: body.ends_at,
    conditions: body.conditions,
    reward: body.reward,
    metadata: body.metadata,
  })

  res.status(201).json({
    offer,
  })
}
