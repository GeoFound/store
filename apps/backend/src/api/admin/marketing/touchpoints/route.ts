import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveMarketingEngineService } from "../../../../platform-adapters/services"
import { localizedError } from "../../../../utils/localized-response"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("marketing-engine")) {
    localizedError(req, res, 503, "marketing.disabled")
    return
  }

  const marketing = resolveMarketingEngineService(req.scope)
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
