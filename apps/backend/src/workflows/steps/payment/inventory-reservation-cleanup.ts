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
    const handlerCode = requireReservationHandlerCode(reservation)
    const dedupeKey = `${handlerCode}:${reservation.reservation_key}`

    if (handledKeys.has(dedupeKey)) {
      continue
    }

    handledKeys.add(dedupeKey)
    const handler = getInventoryHandler(handlerCode)

    if (!handler) {
      throw new Error(`Inventory handler ${handlerCode} is not registered`)
    }

    if (!handler.releaseReservation) {
      throw new Error(
        `Inventory handler ${handlerCode} cannot release reservations`
      )
    }

    await handler.releaseReservation({
      scope: container,
      reservationKey: reservation.reservation_key,
    })
  }
}

function requireReservationHandlerCode(reservation: InventoryReservation) {
  if (
    typeof reservation.handler_code === "string" &&
    reservation.handler_code.trim()
  ) {
    return reservation.handler_code.trim()
  }

  throw new Error(
    "Inventory reservation is missing handler_code and cannot be safely released"
  )
}
