import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

export const STORE_ORDER_DETAIL_FIELDS = [
  "id",
  "status",
  "display_id",
  "custom_display_id",
  "email",
  "currency_code",
  "total",
  "subtotal",
  "created_at",
  "updated_at",
  "items.id",
  "items.title",
  "items.subtitle",
  "items.quantity",
  "items.unit_price",
  "items.compare_at_unit_price",
  "items.thumbnail",
  "items.product_title",
  "items.product_handle",
  "items.variant_id",
  "items.variant_title",
  "items.variant_sku",
]

export async function retrieveStoreOrderDetail(
  container: MedusaContainer,
  orderId: string,
  fields: string[] = STORE_ORDER_DETAIL_FIELDS
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const result = await query.graph({
    entity: "order",
    fields,
    filters: {
      id: orderId,
    },
  })
  const order = result.data?.[0]

  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order was not found")
  }

  return order
}

export function normalizeEmail(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
}
