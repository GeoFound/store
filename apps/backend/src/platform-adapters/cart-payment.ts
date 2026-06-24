import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { StorefrontCartPaymentContext } from "../application/payment"
import type { BackendRuntimeContext } from "../platform/backend-context"
import type { FulfillmentCartItem } from "../platform/inventory"
import { CART_ORDER_QUERY_FIELDS } from "../utils/cart-order"

export async function loadPaymentCartContext(
  scope: BackendRuntimeContext,
  cartId: string
): Promise<StorefrontCartPaymentContext> {
  const query = scope.resolve<{
    graph(input: {
      entity: string
      fields: string[]
      filters: Record<string, unknown>
    }): Promise<{ data?: unknown[] }>
  }>(ContainerRegistrationKeys.QUERY)
  const cartResult = await query.graph({
    entity: "cart",
    fields: CART_ORDER_QUERY_FIELDS,
    filters: {
      id: cartId,
    },
  })
  const cart = cartResult.data?.[0] as
    | (Record<string, unknown> & {
        items?: Array<Record<string, unknown> | null | undefined>
        email?: string
        currency_code?: string
      })
    | undefined

  if (!cart) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart was not found")
  }

  const cartItems = (cart.items || []).filter(
    (item): item is NonNullable<typeof item> => Boolean(item)
  )

  if (!cartItems.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cannot create a payment attempt for an empty cart"
    )
  }

  if (!cart.email) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Guest checkout requires an email before payment"
    )
  }

  const amount =
    normalizeAmount(cart.total) ||
    normalizeAmount(cart.subtotal) ||
    normalizeAmount(cart.raw_total) ||
    normalizeAmount(cart.raw_subtotal) ||
    calculateItemsTotal(cartItems)

  if (!amount || amount <= 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cannot create a payment attempt for a zero total cart"
    )
  }

  return {
    amount,
    currency: String(cart.currency_code || ""),
    customerEmail: cart.email,
    itemCount: cartItems.length,
    items: cartItems as FulfillmentCartItem[],
  }
}

function normalizeAmount(value: unknown): number {
  if (typeof value === "number") {
    return value
  }

  if (typeof value === "string") {
    return Number(value)
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>

    if (typeof record.value === "number") {
      return record.value
    }

    if (typeof record.value === "string") {
      return Number(record.value)
    }

    for (const key of [
      "amount",
      "numeric",
      "raw",
      "calculated_amount",
      "calculated_amount_with_tax",
    ]) {
      const nested = normalizeAmount(record[key])

      if (nested) {
        return nested
      }
    }

    const stringValue = value.toString()

    if (stringValue && stringValue !== "[object Object]") {
      const normalized = Number(stringValue)

      return Number.isFinite(normalized) ? normalized : 0
    }
  }

  return 0
}

function calculateItemsTotal(
  items: Array<{
    unit_price?: unknown
    quantity?: unknown
    total?: unknown
    subtotal?: unknown
  }>
): number {
  return items.reduce((total, item) => {
    const lineTotal =
      normalizeAmount(item.total) || normalizeAmount(item.subtotal)

    if (lineTotal) {
      return total + lineTotal
    }

    const unitPrice = normalizeAmount(item.unit_price)
    const quantity = normalizeAmount(item.quantity) || 1

    return total + unitPrice * quantity
  }, 0)
}
