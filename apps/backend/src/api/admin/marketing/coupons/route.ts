import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveMarketingEngineService } from "../../../../platform-adapters/services"
import { localizedError } from "../../../../utils/localized-response"

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
    localizedError(req, res, 503, "marketing.disabled")
    return
  }

  const marketing = resolveMarketingEngineService(req.scope)
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
    localizedError(req, res, 503, "marketing.disabled")
    return
  }

  const body = (req.validatedBody || req.body) as CreateCouponBody

  if (!body.code) {
    localizedError(req, res, 400, "marketing.codeRequired")
    return
  }

  const marketing = resolveMarketingEngineService(req.scope)

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
