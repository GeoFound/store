import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveSupplierProcurementService } from "../../../../../../platform/services"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const id = req.params.id

  if (!id) {
    res.status(400).json({
      message: "id is required",
    })
    return
  }

  const procurement = resolveSupplierProcurementService(req.scope)
  const result = await procurement.retryProcurementOrder({
    id,
    scope: req.scope,
  })

  res.json(result)
}
