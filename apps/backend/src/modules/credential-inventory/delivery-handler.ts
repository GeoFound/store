import { MedusaError } from "@medusajs/framework/utils"
import type { DeliveryHandler } from "../../platform/delivery"
import { DIGITAL_DELIVERY_MODULE } from "../digital-delivery"
import type DigitalDeliveryModuleService from "../digital-delivery/service"
import { emitAuditLog } from "../../utils/audit-log"
import { CREDENTIAL_INVENTORY_MODULE } from "."
import type CredentialInventoryModuleService from "./service"

export const credentialDeliveryHandler: DeliveryHandler = {
  code: "credential",

  async createDelivery(input) {
    if (!input.scope) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Delivery scope is required"
      )
    }

    if (!input.accountItemId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Credential delivery requires accountItemId"
      )
    }

    const inventory: CredentialInventoryModuleService = input.scope.resolve(
      CREDENTIAL_INVENTORY_MODULE
    )
    const deliveryService: DigitalDeliveryModuleService = input.scope.resolve(
      DIGITAL_DELIVERY_MODULE
    )

    if (!input.deliveryPayload) {
      await emitAuditLog(input.scope, {
        actorType: input.deliveredBy === "system" ? "system" : "admin",
        actorId: input.deliveredBy === "system" ? undefined : input.deliveredBy,
        action: "credential.reveal_for_delivery",
        entityType: "account_item",
        entityId: input.accountItemId,
        riskLevel: "high",
        metadata: {
          payment_attempt_id: input.paymentAttemptId || null,
          order_id: input.orderId || null,
          delivery_handler: credentialDeliveryHandler.code,
        },
      })
    }

    const credential = input.deliveryPayload
      ? input.deliveryPayload
      : (await inventory.revealCredential(input.accountItemId)).credential

    const result = await deliveryService.createManualDelivery({
      ...input,
      accountItemId: input.accountItemId,
      deliveryPayload: credential,
    })

    await inventory.markDelivered({
      accountItemId: input.accountItemId,
    })

    return result
  },
}
