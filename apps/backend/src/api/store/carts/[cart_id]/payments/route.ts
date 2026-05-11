import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { PaymentMethodCode } from "../../../../../modules/payment-router/types"
import type { FulfillmentCartItem } from "../../../../../platform/inventory"
import type { MarketingCheckoutContextInput } from "../../../../../platform/marketing"
import { CART_ORDER_QUERY_FIELDS } from "../../../../../utils/cart-order"
import createCartPaymentAttemptWorkflow from "../../../../../workflows/create-cart-payment-attempt"

type CreateCartPaymentBody = {
  payment_method?: PaymentMethodCode
  marketing?: MarketingCheckoutContextInput
  analytics?: {
    ga_client_id?: string
    ga_session_id?: string
    page_location?: string
    page_path?: string
    referrer?: string
  }
}

export const POST = async (
  req: MedusaRequest<CreateCartPaymentBody>,
  res: MedusaResponse
) => {
  const body = (req.validatedBody || req.body) as CreateCartPaymentBody
  const cartId = req.params.cart_id
  const paymentMethod = body.payment_method || "manual"
  const marketing = normalizeMarketingContext(body.marketing)
  const analytics = normalizeAnalyticsContext(body.analytics)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const cartResult = await query.graph({
    entity: "cart",
    fields: CART_ORDER_QUERY_FIELDS,
    filters: {
      id: cartId,
    },
  })
  const cart = cartResult.data?.[0]

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
    normalizeAmount((cart as Record<string, unknown>).raw_total) ||
    normalizeAmount((cart as Record<string, unknown>).raw_subtotal) ||
    calculateItemsTotal(cartItems)

  if (!amount || amount <= 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cannot create a payment attempt for a zero total cart"
    )
  }

  const workflowResult = await createCartPaymentAttemptWorkflow(req.scope).run({
    input: {
      cartId,
      amount,
      currency: cart.currency_code,
      paymentMethod,
      customerEmail: cart.email,
      metadata: {
        item_count: cartItems.length,
        analytics_context: analytics,
      },
      marketing,
      items: cartItems as FulfillmentCartItem[],
    },
  })

  const { attempt, instructions, claimToken, marketingContext } = workflowResult.result

  res.json({
    attempt: {
      id: attempt.id,
      cart_id: attempt.cart_id,
      provider_order_id: attempt.provider_order_id,
      amount: attempt.amount,
      currency: attempt.currency,
      status: attempt.status,
      provider_code: attempt.provider_code,
    },
    instructions,
    claim_token: claimToken,
    marketing: marketingContext,
  })
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

function normalizeMarketingContext(value: unknown): MarketingCheckoutContextInput {
  if (!value || typeof value !== "object") {
    return {}
  }

  const record = value as Record<string, unknown>

  return {
    coupon_code: normalizeOptionalText(record.coupon_code),
    referral_code: normalizeOptionalText(record.referral_code),
    utm_source: normalizeOptionalText(record.utm_source),
    utm_medium: normalizeOptionalText(record.utm_medium),
    utm_campaign: normalizeOptionalText(record.utm_campaign),
    utm_content: normalizeOptionalText(record.utm_content),
    utm_term: normalizeOptionalText(record.utm_term),
  }
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()

  return trimmed ? trimmed.slice(0, 160) : undefined
}

function normalizeAnalyticsContext(value: unknown) {
  if (!value || typeof value !== "object") {
    return {}
  }

  const record = value as Record<string, unknown>

  return {
    ga_client_id: normalizeAnalyticsText(record.ga_client_id, 128),
    ga_session_id: normalizeAnalyticsText(record.ga_session_id, 128),
    page_location: normalizeAnalyticsText(record.page_location, 2000),
    page_path: normalizeAnalyticsText(record.page_path, 500),
    referrer: normalizeAnalyticsText(record.referrer, 2000),
  }
}

function normalizeAnalyticsText(value: unknown, max: number) {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()

  return trimmed ? trimmed.slice(0, max) : undefined
}
