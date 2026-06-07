import type { BackendRuntimeContext } from "../platform/backend-context"
import { DIGITAL_DELIVERY_MODULE } from "../modules/digital-delivery"
import type DigitalDeliveryModuleService from "../modules/digital-delivery/service"
import { SUPPLIER_PROCUREMENT_MODULE } from "../modules/supplier-procurement"
import type { PreparedSupplierDeliveryRecord } from "../modules/supplier-procurement/service"
import type SupplierProcurementModuleService from "../modules/supplier-procurement/service"
import { createSupplierProviderScope } from "./backend-context"

export async function createPreparedSupplierDeliveryRecord(
  scope: BackendRuntimeContext,
  prepared: PreparedSupplierDeliveryRecord
) {
  const deliveryService = scope.resolve<DigitalDeliveryModuleService>(
    DIGITAL_DELIVERY_MODULE
  )
  const deliveryResult = await deliveryService.createManualDelivery(
    prepared.deliveryInput
  )
  const deliveryId = toOptionalText(deliveryResult.delivery.id)

  if (deliveryId) {
    const procurement = scope.resolve<SupplierProcurementModuleService>(
      SUPPLIER_PROCUREMENT_MODULE
    )
    await procurement.rememberDeliveryRecord({
      procurementOrderId: String(prepared.procurement.id),
      deliveryId,
    })
  }

  return deliveryResult
}

export async function retrySupplierProcurementWithDelivery(input: {
  scope: BackendRuntimeContext
  id: string
  forceRetry?: boolean
}) {
  const procurement = input.scope.resolve<SupplierProcurementModuleService>(
    SUPPLIER_PROCUREMENT_MODULE
  )
  const retryResult = await procurement.retryProcurementOrder({
    id: input.id,
    scope: createSupplierProviderScope(input.scope),
    forceRetry: input.forceRetry,
  })

  if (!retryResult.delivery) {
    return retryResult
  }

  const deliveryResult = await createPreparedSupplierDeliveryRecord(
    input.scope,
    retryResult.delivery
  )

  return {
    procurement: retryResult.procurement,
    delivery: deliveryResult.delivery,
    accessToken: deliveryResult.accessToken,
  }
}

function toOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
