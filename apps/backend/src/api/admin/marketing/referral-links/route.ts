import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveMarketingEngineService } from "../../../../platform/services"
import { localizedError } from "../../../../utils/localized-response"

type CreateReferralLinkBody = {
  campaign_id?: string | null
  code?: string
  referrer_id?: string | null
  referrer_email?: string | null
  status?: "active" | "disabled"
  max_uses?: number | null
  landing_path?: string | null
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

  const referral_links = await marketing.listReferralLinksSafe({
    status: query.status,
    campaignId: query.campaign_id,
    code: query.code,
    limit: query.limit,
  })

  res.json({
    referral_links,
  })
}

export const POST = async (
  req: MedusaRequest<CreateReferralLinkBody>,
  res: MedusaResponse
) => {
  if (!isPlatformPluginEnabled("marketing-engine")) {
    localizedError(req, res, 503, "marketing.disabled")
    return
  }

  const body = (req.validatedBody || req.body) as CreateReferralLinkBody

  if (!body.code) {
    localizedError(req, res, 400, "marketing.codeRequired")
    return
  }

  const marketing = resolveMarketingEngineService(req.scope)

  const referral_link = await marketing.createReferralLinkSafe({
    campaignId: body.campaign_id,
    code: body.code,
    referrerId: body.referrer_id,
    referrerEmail: body.referrer_email,
    status: body.status,
    maxUses: body.max_uses,
    landingPath: body.landing_path,
    metadata: body.metadata,
  })

  res.status(201).json({
    referral_link,
  })
}
