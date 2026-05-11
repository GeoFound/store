import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ANALYTICS_CORE_MODULE,
} from "../../../../modules/analytics-core"
import type AnalyticsCoreModuleService from "../../../../modules/analytics-core/service"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("analytics-core")) {
    res.status(503).json({
      message: "Analytics core plugin is disabled",
    })
    return
  }

  const analytics: AnalyticsCoreModuleService = req.scope.resolve(
    ANALYTICS_CORE_MODULE
  )
  const query = (req.validatedQuery || req.query) as {
    destination_code?: string
    status?: "pending" | "processing" | "delivered" | "failed" | "dead"
    event_id?: string
    limit?: number
  }

  const dispatches = await analytics.listDispatchesSafe({
    destinationCode: query.destination_code,
    status: query.status,
    eventId: query.event_id,
    limit: query.limit,
  })

  res.json({
    dispatches,
  })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("analytics-core")) {
    res.status(503).json({
      message: "Analytics core plugin is disabled",
    })
    return
  }

  const analytics: AnalyticsCoreModuleService = req.scope.resolve(
    ANALYTICS_CORE_MODULE
  )
  const body = (req.validatedBody || req.body) as {
    dispatch_id?: string
  }

  if (!body.dispatch_id || typeof body.dispatch_id !== "string") {
    res.status(400).json({
      message: "dispatch_id is required",
    })
    return
  }

  const dispatch = await analytics.replayDispatch({
    dispatchId: body.dispatch_id,
  })

  res.json({
    dispatch,
  })
}
