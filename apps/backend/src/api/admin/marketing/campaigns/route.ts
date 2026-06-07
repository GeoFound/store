import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveMarketingEngineService } from "../../../../platform-adapters/services"
import { localizedError } from "../../../../utils/localized-response"

type CreateCampaignBody = {
  code?: string
  name?: string
  description?: string | null
  status?: "draft" | "active" | "paused" | "archived"
  starts_at?: string | null
  ends_at?: string | null
  budget_limit?: number | null
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
    code?: string
    limit?: number
  }

  const campaigns = await marketing.listCampaignsSafe({
    status: query.status,
    code: query.code,
    limit: query.limit,
  })

  res.json({
    campaigns,
  })
}

export const POST = async (
  req: MedusaRequest<CreateCampaignBody>,
  res: MedusaResponse
) => {
  if (!isPlatformPluginEnabled("marketing-engine")) {
    localizedError(req, res, 503, "marketing.disabled")
    return
  }

  const body = (req.validatedBody || req.body) as CreateCampaignBody

  if (!body.code || !body.name) {
    localizedError(req, res, 400, "marketing.namedRequired")
    return
  }

  const marketing = resolveMarketingEngineService(req.scope)

  const campaign = await marketing.createCampaignSafe({
    code: body.code,
    name: body.name,
    description: body.description,
    status: body.status,
    startsAt: body.starts_at,
    endsAt: body.ends_at,
    budgetLimit: body.budget_limit,
    metadata: body.metadata,
  })

  res.status(201).json({
    campaign,
  })
}
