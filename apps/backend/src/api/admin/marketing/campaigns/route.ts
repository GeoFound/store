import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_ENGINE_MODULE } from "../../../../modules/marketing-engine"
import type MarketingEngineModuleService from "../../../../modules/marketing-engine/service"

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
  const marketing: MarketingEngineModuleService = req.scope.resolve(
    MARKETING_ENGINE_MODULE
  )
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
  const body = (req.validatedBody || req.body) as CreateCampaignBody

  if (!body.code || !body.name) {
    res.status(400).json({
      message: "code and name are required",
    })
    return
  }

  const marketing: MarketingEngineModuleService = req.scope.resolve(
    MARKETING_ENGINE_MODULE
  )

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
