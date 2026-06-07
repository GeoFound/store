import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { ensurePlatformIntegrationsRegistered } from "../platform-adapters/integrations"
import { resolveSupplierProcurementService } from "../platform-adapters/services"
import { isPlatformPluginEnabled } from "../platform/runtime"

export default async function processSupplierProcurements(
  container: MedusaContainer
) {
  ensurePlatformIntegrationsRegistered()

  if (!isPlatformPluginEnabled("supplier-procurement")) {
    return
  }

  const procurement = resolveSupplierProcurementService(container)
  const locking = container.resolve(Modules.LOCKING)
  const logger = container.resolve("logger") as {
    info: (message: string, meta?: Record<string, unknown>) => void
    error: (message: string, meta?: Record<string, unknown>) => void
  }
  const dueProcurements = await procurement.listDueProcurementsForRetry({
    limit: resolveSupplierProcurementRetryBatchSize(),
  })
  let processed = 0
  let failed = 0

  for (const item of dueProcurements) {
    const procurementId = String(item.id || "")

    if (!procurementId) {
      continue
    }

    await locking.execute(
      `supplier_procurement:${procurementId}`,
      async () => {
        const current = await procurement.retrieveSupplierProcurementOrder(
          procurementId
        )
        const retryAt = toDateOrNull(current.next_retry_at)

        if (!retryAt || retryAt.getTime() > Date.now()) {
          return
        }

        try {
          await procurement.retryProcurementOrder({
            id: procurementId,
            scope: container,
            forceRetry: false,
          })
          processed += 1
        } catch (error) {
          failed += 1
          logger.error("Supplier procurement retry failed", {
            supplier_procurement_order_id: procurementId,
            error: error instanceof Error ? error.message : "unknown",
          })
        }
      },
      {
        timeout: 30,
      }
    )
  }

  if (processed || failed) {
    logger.info("Processed supplier procurement retry batch", {
      processed,
      failed,
    })
  }
}

export const config = {
  name: "process-supplier-procurements",
  schedule: "* * * * *",
}

function resolveSupplierProcurementRetryBatchSize() {
  const value = Number(process.env.SUPPLIER_PROCUREMENT_RETRY_BATCH_SIZE)

  if (Number.isFinite(value) && value >= 1) {
    return Math.min(Math.floor(value), 200)
  }

  return 25
}

function toDateOrNull(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value)
    return Number.isFinite(parsed.getTime()) ? parsed : null
  }

  return null
}
