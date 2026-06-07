import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  resolveCredentialInventoryService,
  resolveDigitalDeliveryService,
} from "../../../../platform-adapters/services"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const inventory = resolveCredentialInventoryService(req.scope)
  const deliveryService = resolveDigitalDeliveryService(req.scope)
  const query = (req.validatedQuery || req.query) as {
    product_variant_id?: string
    limit?: number
  }
  const limit =
    typeof query.limit === "number" && Number.isFinite(query.limit)
      ? query.limit
      : undefined
  const productVariantId = query.product_variant_id || ""

  const [soldItems, pendingDeliveries] = await Promise.all([
    inventory.listAccountItemsSafe({
      productVariantId,
      status: "sold",
      undeliveredOnly: true,
      limit,
    }),
    deliveryService.listDeliveriesSafe({
      status: "pending",
      productVariantId,
      limit,
    }),
  ])

  const items = [
    ...soldItems.map((item) => ({
      kind: "credential",
      ...item,
    })),
    ...pendingDeliveries.map((delivery) => {
      const metadata = normalizeRecord(delivery.metadata_json)

      return {
        kind: "delivery",
        id: delivery.id,
        delivery_id: delivery.id,
        display_label: `Pending delivery ${delivery.id}`,
        account_identifier: delivery.access_token_hint || "",
        product_variant_id:
          toOptionalString(metadata.product_variant_id) ||
          toOptionalString(metadata.productVariantId) ||
          "-",
        cart_id: delivery.cart_id || null,
        order_id: delivery.order_id || null,
        payment_attempt_id: delivery.payment_attempt_id || null,
        created_at: delivery.created_at || null,
        metadata_json: metadata,
      }
    }),
  ].sort((left, right) => getCreatedAtTime(right) - getCreatedAtTime(left))

  res.json({
    items: typeof limit === "number" ? items.slice(0, limit) : items,
  })
}

function normalizeRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function getCreatedAtTime(item: Record<string, unknown>) {
  const value = item.created_at
  return typeof value === "string" || value instanceof Date
    ? new Date(value).getTime()
    : 0
}
