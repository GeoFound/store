import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveSupplierProcurementService } from "../../../../../../platform/services"
import { localizedError } from "../../../../../../utils/localized-response"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const id = req.params.id

  if (!id) {
    localizedError(req, res, 400, "supplier.procurementIdRequired")
    return
  }

  const procurement = resolveSupplierProcurementService(req.scope)
  const result = await procurement.retryProcurementOrder({
    id,
    scope: req.scope,
  })

  res.json(result)
}
