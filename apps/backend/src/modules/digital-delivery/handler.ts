import { MedusaError } from "@medusajs/framework/utils"
import type { DeliveryHandler } from "../../platform/delivery"
import { DIGITAL_DELIVERY_MODULE } from "."
import type DigitalDeliveryModuleService from "./service"

export const manualDeliveryHandler: DeliveryHandler = {
  code: "manual",

  async createDelivery(input) {
    if (!input.scope) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Delivery scope is required"
      )
    }

    const deliveryService: DigitalDeliveryModuleService = input.scope.resolve(
      DIGITAL_DELIVERY_MODULE
    )

    return deliveryService.createManualDelivery(input)
  },
}
