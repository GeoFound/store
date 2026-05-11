import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveAnalyticsCoreService } from "../../../../platform/services"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("analytics-core")) {
    res.status(503).json({
      message: "Analytics core plugin is disabled",
    })
    return
  }

  const analytics = resolveAnalyticsCoreService(req.scope)
  const query = (req.validatedQuery || req.query) as {
    event_name?: string
    source?: "backend_hook" | "storefront" | "system"
    status?: "pending" | "processing" | "delivered" | "failed" | "partial"
    destination_code?: string
    order_id?: string
    payment_attempt_id?: string
    limit?: number
  }

  const events = await analytics.listEventsSafe({
    eventName: query.event_name,
    source: query.source,
    status: query.status,
    destinationCode: query.destination_code,
    orderId: query.order_id,
    paymentAttemptId: query.payment_attempt_id,
    limit: query.limit,
  })

  res.json({
    events,
  })
}
