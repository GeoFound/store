import type { MedusaContainer } from "@medusajs/framework/types"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { resolveCredentialInventoryService } from "../platform-adapters/services"

export default async function releaseExpiredCredentialReservations(
  container: MedusaContainer
) {
  const inventory = resolveCredentialInventoryService(container)
  const locking: ILockingModule = container.resolve(Modules.LOCKING)
  const logger = container.resolve("logger")
  const now = new Date()
  const reservationKeys = await inventory.listExpiredReservationKeys(now)
  const released: Array<Record<string, unknown>> = []

  for (const reservationKey of reservationKeys) {
    const items = await locking.execute(
      `credential-reservation:${reservationKey}`,
      async () =>
        inventory.releaseReservation({
          reservationKey,
          onlyExpiredBefore: now,
        }),
      {
        timeout: 30,
      }
    )
    released.push(...items)
  }

  if (released.length) {
    logger.info(`Released ${released.length} expired credential reservations`)
  }
}

export const config = {
  name: "release-expired-credential-reservations",
  schedule: "* * * * *",
}
