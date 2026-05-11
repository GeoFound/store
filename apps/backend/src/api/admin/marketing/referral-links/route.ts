import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_ENGINE_MODULE } from "../../../../modules/marketing-engine"
import type MarketingEngineModuleService from "../../../../modules/marketing-engine/service"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"

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
    res.status(503).json({
      message: "Marketing engine plugin is disabled",
    })
    return
  }

  const body = (req.validatedBody || req.body) as CreateReferralLinkBody

  if (!body.code) {
    res.status(400).json({
      message: "code is required",
    })
    return
  }

  const marketing: MarketingEngineModuleService = req.scope.resolve(
    MARKETING_ENGINE_MODULE
  )

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
