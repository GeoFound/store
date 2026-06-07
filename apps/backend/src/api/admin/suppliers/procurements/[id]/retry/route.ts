import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { retrySupplierProcurementWithDelivery } from "../../../../../../platform-adapters/supplier-procurement"
import { localizedError } from "../../../../../../utils/localized-response"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const id = req.params.id

  if (!id) {
    localizedError(req, res, 400, "supplier.procurementIdRequired")
    return
  }

  const result = await retrySupplierProcurementWithDelivery({
    id,
    scope: req.scope,
  })

  res.json(result)
}
