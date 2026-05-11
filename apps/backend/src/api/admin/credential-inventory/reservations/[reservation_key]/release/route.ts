import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import CredentialInventoryModuleService from "../../../../../../modules/credential-inventory/service"
import { CREDENTIAL_INVENTORY_MODULE } from "../../../../../../modules/credential-inventory"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const locking: ILockingModule = req.scope.resolve(Modules.LOCKING)
  const inventory: CredentialInventoryModuleService = req.scope.resolve(
    CREDENTIAL_INVENTORY_MODULE
  )

  const items = await locking.execute(
    `credential-reservation:${req.params.reservation_key}`,
    async () =>
      inventory.releaseReservation({
        reservationKey: req.params.reservation_key,
      }),
    {
      timeout: 30,
    }
  )

  res.json({
    items,
  })
}
