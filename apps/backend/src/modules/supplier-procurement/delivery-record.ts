import { MedusaError } from "@medusajs/framework/utils"
import type { CreateSupplierDeliveryInput } from "./types"
import { normalizeRecord } from "./service-helpers"

type SupplierProcurementOrderRecord = Record<string, any>

export type PreparedSupplierDeliveryRecord = {
  procurement: SupplierProcurementOrderRecord
  deliveryInput: CreateSupplierDeliveryInput
}

export function prepareSupplierDeliveryRecord(
  input: CreateSupplierDeliveryInput,
  order: SupplierProcurementOrderRecord,
  result: {
    deliveryPayload?: Record<string, unknown> | string
    deliveryStatus: "pending" | "delivered"
    message?: string | null
  }
): PreparedSupplierDeliveryRecord {
  if (!input.scope) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Supplier delivery scope is required"
    )
  }

  const orderMetadata = normalizeRecord(order.metadata_json)
  const deliveryPayload =
    result.deliveryPayload ||
    ({
      status: "pending",
      message: result.message || "Supplier procurement is pending.",
      supplier_procurement_order_id: order.id,
      supplier_provider: order.provider_code,
      supplier_provider_order_id: order.provider_order_id || null,
    } satisfies Record<string, unknown>)
  return {
    procurement: order,
    deliveryInput: {
      ...input,
      accountItemId: null,
      deliveryHandlerCode: "supplier-procurement",
      deliveryStatus: result.deliveryStatus,
      deliveryPayload,
      deliveredBy: input.deliveredBy || "system",
      metadata: {
        ...normalizeRecord(input.metadata),
        ...orderMetadata,
        supplier_procurement_order_id: order.id,
        supplier_provider: order.provider_code,
        supplier_provider_order_id: order.provider_order_id || null,
      },
    },
  }
}
