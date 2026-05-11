import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_ENGINE_MODULE } from "../../../../modules/marketing-engine"
import type MarketingEngineModuleService from "../../../../modules/marketing-engine/service"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"

type CreateCouponBody = {
  campaign_id?: string | null
  offer_id?: string | null
  code?: string
  status?: "active" | "disabled" | "expired"
  max_redemptions?: number | null
  max_redemptions_per_email?: number | null
  starts_at?: string | null
  expires_at?: string | null
  metadata?: Record<string, unknown> | null
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("marketing-engine")) {
    res.status(503).json({
      message: "Marketing engine plugin is disabled",
    })
    return
  }

  const marketing: MarketingEngineModuleService = req.scope.resolve(
    MARKETING_ENGINE_MODULE
  )
  const query = (req.validatedQuery || req.query) as {
    status?: string
    campaign_id?: string
    code?: string
    limit?: number
  }

  const coupons = await marketing.listCouponsSafe({
    status: query.status,
    campaignId: query.campaign_id,
    code: query.code,
    limit: query.limit,
  })

  res.json({
    coupons,
  })
}

export const POST = async (
  req: MedusaRequest<CreateCouponBody>,
  res: MedusaResponse
) => {
  if (!isPlatformPluginEnabled("marketing-engine")) {
    res.status(503).json({
      message: "Marketing engine plugin is disabled",
    })
    return
  }

  const body = (req.validatedBody || req.body) as CreateCouponBody

  if (!body.code) {
    res.status(400).json({
      message: "code is required",
    })
    return
  }

  const marketing: MarketingEngineModuleService = req.scope.resolve(
    MARKETING_ENGINE_MODULE
  )

  const coupon = await marketing.createCouponSafe({
    campaignId: body.campaign_id,
    offerId: body.offer_id,
    code: body.code,
    status: body.status,
    maxRedemptions: body.max_redemptions,
    maxRedemptionsPerEmail: body.max_redemptions_per_email,
    startsAt: body.starts_at,
    expiresAt: body.expires_at,
    metadata: body.metadata,
  })

  res.status(201).json({
    coupon,
  })
}
