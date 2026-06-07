import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { resolveCredentialInventoryService } from "../../../../../../platform-adapters/services"

type SellBody = {
  order_id?: string
}

export const POST = async (
  req: MedusaRequest<SellBody>,
  res: MedusaResponse
) => {
  const body = (req.validatedBody || req.body) as SellBody
  const locking: ILockingModule = req.scope.resolve(Modules.LOCKING)
  const inventory = resolveCredentialInventoryService(req.scope)

  const items = await locking.execute(
    `credential-reservation:${req.params.reservation_key}`,
    async () =>
      inventory.markReservationSold({
        reservationKey: req.params.reservation_key,
        orderId: body.order_id,
      }),
    {
      timeout: 30,
    }
  )

  res.json({
    items,
  })
}
