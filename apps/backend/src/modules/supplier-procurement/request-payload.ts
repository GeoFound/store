import type { CreateSupplierDeliveryInput } from "./types"
import { normalizeRecord, redactSensitiveRecord, toOptionalText } from "./service-helpers"

export function resolveSupplierIdempotencyKey(
  input: CreateSupplierDeliveryInput,
  providerCode: string
) {
  const metadata = normalizeRecord(input.metadata)
  const explicit =
    toOptionalText(metadata.supplier_idempotency_key) ||
    toOptionalText(metadata.supplierIdempotencyKey)

  if (explicit) {
    return explicit
  }

  const fulfillmentKey =
    toOptionalText(metadata.fulfillment_key) ||
    toOptionalText(metadata.fulfillmentKey) ||
    input.orderItemId ||
    input.productVariantId ||
    "item"

  return [
    "supplier",
    providerCode,
    input.paymentAttemptId || input.orderId || input.cartId || "manual",
    fulfillmentKey,
  ].join(":")
}

export function buildSafeSupplierRequestPayload(context: {
  providerCode: string
  providerSku: string
  productVariantId: string
  quantity: number
  customerEmail: string | null
  currency: string | null
  regionCode: string | null
  metadata: Record<string, unknown>
}) {
  return {
    provider_code: context.providerCode,
    provider_sku: context.providerSku,
    product_variant_id: context.productVariantId,
    quantity: context.quantity,
    customer_email: context.customerEmail,
    currency: context.currency,
    region_code: context.regionCode,
    metadata: redactSensitiveRecord(context.metadata),
  }
}
