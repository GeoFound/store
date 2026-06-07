import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { resolveCredentialInventoryService } from "../../../../../../platform-adapters/services"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const locking: ILockingModule = req.scope.resolve(Modules.LOCKING)
  const inventory = resolveCredentialInventoryService(req.scope)

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
