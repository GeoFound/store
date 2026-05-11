import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  ANALYTICS_CORE_MODULE,
} from "../modules/analytics-core"
import type AnalyticsCoreModuleService from "../modules/analytics-core/service"
import { getAnalyticsDispatchConfig } from "../modules/analytics-core/config"
import {
  getAnalyticsDestination,
  listAnalyticsDestinations,
} from "../modules/analytics-core/destinations/registry"
import { ensureAnalyticsGa4DestinationRegistered } from "../modules/analytics-ga4/destination"

export default async function processAnalyticsDispatches(container: MedusaContainer) {
  ensureAnalyticsGa4DestinationRegistered()

  const config = getAnalyticsDispatchConfig()

  if (!config.enabled) {
    return
  }

  const analytics: AnalyticsCoreModuleService = container.resolve(
    ANALYTICS_CORE_MODULE
  )
  const locking = container.resolve(Modules.LOCKING)
  const logger = container.resolve("logger") as {
    info: (message: string, meta?: Record<string, unknown>) => void
    error: (message: string, meta?: Record<string, unknown>) => void
  }

  let processed = 0
  let failed = 0

  for (const destination of listAnalyticsDestinations()) {
    const queue = await analytics.listDispatchesForDelivery({
      destinationCode: destination.code,
      limit: config.batchSize,
    })

    for (const dispatch of queue) {
      const dispatchId = String(dispatch.id)

      await locking.execute(
        `analytics_dispatch:${dispatchId}`,
        async () => {
          const current = await analytics.retrieveAnalyticsDispatch(dispatchId)
          const now = new Date()
          const currentStatus = String(current.status)

          if (currentStatus !== "pending" && currentStatus !== "failed") {
            return
          }

          const retryAt = toDateOrNull(current.next_retry_at)

          if (retryAt && retryAt.getTime() > now.getTime()) {
            return
          }

          await analytics.markDispatchProcessing(dispatchId)

          try {
            const event = await analytics.retrieveAnalyticsEvent(String(current.event_id))
            const destinationImpl = getAnalyticsDestination(
              String(current.destination_code)
            )

            if (!destinationImpl) {
              throw new Error(
                `Analytics destination ${String(current.destination_code)} is unavailable`
              )
            }

            const result = await destinationImpl.send({
              event,
              dispatch: current,
            })

            await analytics.markDispatchDelivered({
              dispatchId,
              responseStatus: result.status,
              responseBody: result.responseBody,
            })

            processed += 1
          } catch (err) {
            failed += 1
            await analytics.markDispatchFailed({
              dispatchId,
              errorMessage:
                err instanceof Error ? err.message : "Unknown analytics dispatch error",
            })

            logger.error("Analytics dispatch failed", {
              dispatch_id: dispatchId,
              destination_code: current.destination_code,
              error: err instanceof Error ? err.message : "unknown",
            })
          }
        },
        {
          timeout: 20,
        }
      )
    }
  }

  if (processed || failed) {
    logger.info("Processed analytics dispatch batch", {
      processed,
      failed,
    })
  }
}

export const config = {
  name: "process-analytics-dispatches",
  schedule: "* * * * *",
}

function toDateOrNull(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value)

    if (Number.isFinite(parsed.getTime())) {
      return parsed
    }
  }

  return null
}
