import { Modules } from "@medusajs/framework/utils"
import type { ILockingModule } from "@medusajs/framework/types"
import type {
  InventoryHandler,
  ReserveInventoryInput,
} from "../../platform/inventory"
import { CREDENTIAL_INVENTORY_MODULE } from "."
import type CredentialInventoryModuleService from "./service"

export const credentialInventoryHandler: InventoryHandler = {
  code: "credential-inventory",

  async reserve(input: ReserveInventoryInput) {
    const locking: ILockingModule = input.scope.resolve(Modules.LOCKING)
    const inventory: CredentialInventoryModuleService = input.scope.resolve(
      CREDENTIAL_INVENTORY_MODULE
    )

    const reserved = await locking.execute(
      `credential-variant:${input.productVariantId}`,
      async () =>
        inventory.reserveCredentials({
          productVariantId: input.productVariantId,
          quantity: input.quantity,
          reservationKey: input.reservationKey,
          cartId: input.cartId,
          ttlSeconds: input.ttlSeconds,
        }),
      {
        timeout: 30,
      }
    )

    return [
      {
        handler_code: credentialInventoryHandler.code,
        reservation_key: input.reservationKey,
        item_ids: reserved
          .map((reservedItem) => reservedItem.id)
          .filter((id): id is string => typeof id === "string"),
        metadata: input.metadata,
      },
    ]
  },

  async finalizeReservation(input) {
    const locking: ILockingModule = input.scope.resolve(Modules.LOCKING)
    const inventory: CredentialInventoryModuleService = input.scope.resolve(
      CREDENTIAL_INVENTORY_MODULE
    )

    await locking.execute(
      `credential-reservation:${input.reservation.reservation_key}`,
      async () =>
        inventory.markReservationSold({
          reservationKey: input.reservation.reservation_key,
          orderId: input.orderId,
        }),
      {
        timeout: 30,
      }
    )
  },

  async releaseReservation(input) {
    const locking: ILockingModule = input.scope.resolve(Modules.LOCKING)
    const inventory: CredentialInventoryModuleService = input.scope.resolve(
      CREDENTIAL_INVENTORY_MODULE
    )

    return locking.execute(
      `credential-reservation:${input.reservationKey}`,
      async () =>
        inventory.releaseReservation({
          reservationKey: input.reservationKey,
        }),
      {
        timeout: 30,
      }
    )
  },

  async listAvailability(input) {
    const inventory: CredentialInventoryModuleService = input.scope.resolve(
      CREDENTIAL_INVENTORY_MODULE
    )

    return inventory.listVariantAvailability({
      variantIds: input.variantIds,
    })
  },
}
