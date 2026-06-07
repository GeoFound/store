import type { CreateDeliveryInput } from "../../platform/delivery"

export type SupplierProcurementStatus =
  | "pending"
  | "processing"
  | "fulfilled"
  | "failed"
  | "cancelled"
  | "needs_review"

export type SupplierProductMappingInput = {
  productVariantId: string
  providerCode: string
  providerSku: string
  providerProductId?: string | null
  providerVariantId?: string | null
  regionCode?: string | null
  currency?: string | null
  enabled?: boolean
  priority?: number
  costPrice?: number | null
  listPrice?: number | null
  metadata?: Record<string, unknown> | null
}

export type ListSupplierMappingsInput = {
  productVariantId?: string
  providerCode?: string
  enabled?: boolean
  limit?: number
}

export type ListSupplierProcurementsInput = {
  status?: SupplierProcurementStatus
  providerCode?: string
  productVariantId?: string
  orderId?: string
  paymentAttemptId?: string
  limit?: number
}

export type ListDueSupplierProcurementsInput = {
  statuses?: SupplierProcurementStatus[]
  limit?: number
  now?: Date
}

export type CreateSupplierDeliveryInput = CreateDeliveryInput
