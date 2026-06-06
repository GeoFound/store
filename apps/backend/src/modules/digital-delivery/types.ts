import type { BackendRuntimeContext } from "../../platform/backend-context"

export type CreateManualDeliveryInput = {
  scope?: BackendRuntimeContext
  deliveryId?: string
  orderId?: string
  cartId?: string
  paymentAttemptId?: string
  orderItemId?: string
  accountItemId?: string | null
  productVariantId?: string
  productType?: string | null
  fulfillmentPolicyCode?: string | null
  deliveryHandlerCode?: string | null
  deliveryStatus?: "pending" | "delivered"
  inventoryReservation?: {
    handler_code?: string
    reservation_key: string
    item_ids: string[]
    metadata?: Record<string, unknown>
  }
  deliveryPayload?: Record<string, unknown> | string
  deliveredBy?: string
  deliveryNote?: string
  metadata?: Record<string, unknown>
}

export type DeliveryLookupResult = {
  delivery: Record<string, unknown>
  payload: Record<string, unknown> | string
}
