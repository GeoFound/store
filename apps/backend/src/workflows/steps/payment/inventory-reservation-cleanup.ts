import type { MedusaContainer } from "@medusajs/framework/types"
import {
  getInventoryHandler,
  type InventoryReservation,
} from "../../../platform/inventory"

export async function releaseInventoryReservations(
  container: MedusaContainer,
  reservations: InventoryReservation[]
) {
  const handledKeys = new Set<string>()

  for (const reservation of reservations) {
    const handlerCode = reservation.handler_code || "credential-inventory"
    const dedupeKey = `${handlerCode}:${reservation.reservation_key}`

    if (handledKeys.has(dedupeKey)) {
      continue
    }

    handledKeys.add(dedupeKey)
    const handler = getInventoryHandler(handlerCode)

    if (!handler?.releaseReservation) {
      continue
    }

    try {
      await handler.releaseReservation({
        scope: container,
        reservationKey: reservation.reservation_key,
      })
    } catch {
      // Best-effort cleanup. The expiry job still acts as a final safeguard.
    }
  }
}
