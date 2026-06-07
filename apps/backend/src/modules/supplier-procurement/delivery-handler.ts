import { MedusaError } from "@medusajs/framework/utils"
import type { DeliveryHandler } from "../../platform/delivery"
import { createSupplierProviderScope } from "../../platform-adapters/backend-context"
import { createPreparedSupplierDeliveryRecord } from "../../platform-adapters/supplier-procurement"
import { SUPPLIER_PROCUREMENT_MODULE } from "."
import type SupplierProcurementModuleService from "./service"

export const supplierProcurementDeliveryHandler: DeliveryHandler = {
  code: "supplier-procurement",

  async createDelivery(input) {
    if (!input.scope) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Supplier delivery scope is required"
      )
    }

    const procurement: SupplierProcurementModuleService = input.scope.resolve(
      SUPPLIER_PROCUREMENT_MODULE
    )
    const prepared = await procurement.createSupplierDelivery({
      ...input,
      scope: createSupplierProviderScope(input.scope),
    })

    return createPreparedSupplierDeliveryRecord(input.scope, prepared)
  },
}
