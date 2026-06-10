import type { CreateSupplierDeliveryInput } from "./types"
import { prepareSupplierDeliveryRecord } from "./delivery-record"

type SupplierProcurementOrderRecord = Record<string, any>

export function initialSupplierProcurementStatus(enabled: boolean) {
  return enabled ? "pending" : "needs_review"
}

export function supplierAutoProcurementError(enabled: boolean) {
  return enabled ? null : "Supplier auto procurement is disabled"
}

export function supplierAutoProcurementMetadata(input: {
  metadata: Record<string, unknown>
  enabled: boolean
  mappingId?: string | null
}) {
  return {
    ...input.metadata,
    supplier_auto_procurement_enabled: input.enabled,
    supplier_mapping_id: input.mappingId || null,
  }
}

export function shouldQueueSupplierManualReview(input: {
  enabled: boolean
  order: SupplierProcurementOrderRecord
}) {
  return !input.enabled && input.order.status !== "fulfilled"
}

export function prepareSupplierManualReviewDelivery(
  input: CreateSupplierDeliveryInput,
  order: SupplierProcurementOrderRecord
) {
  return prepareSupplierDeliveryRecord(input, order, {
    deliveryStatus: "pending",
    message:
      "Supplier auto procurement is disabled; order is queued for manual review.",
  })
}
