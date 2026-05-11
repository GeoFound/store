import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_ENGINE_MODULE } from "../../../../modules/marketing-engine"
import type MarketingEngineModuleService from "../../../../modules/marketing-engine/service"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"

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
    event_name?: string
    payment_attempt_id?: string
    order_id?: string
    limit?: number
  }

  const touchpoints = await marketing.listTouchpointsSafe({
    eventName: query.event_name,
    paymentAttemptId: query.payment_attempt_id,
    orderId: query.order_id,
    limit: query.limit,
  })

  res.json({
    touchpoints,
  })
}
