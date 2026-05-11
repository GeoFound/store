import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ANALYTICS_CORE_MODULE,
} from "../../../../modules/analytics-core"
import type AnalyticsCoreModuleService from "../../../../modules/analytics-core/service"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const analytics: AnalyticsCoreModuleService = req.scope.resolve(
    ANALYTICS_CORE_MODULE
  )
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
