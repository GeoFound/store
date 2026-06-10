import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { MarketingCheckoutContextInput } from "../../../../../platform/marketing"
import type { PaymentMethodCode } from "../../../../../platform/payment-providers"
import createCartPaymentAttemptWorkflow from "../../../../../workflows/create-cart-payment-attempt"
import { loadPaymentCartContext } from "./cart-payment-cart"

type CreateCartPaymentBody = {
  payment_method: PaymentMethodCode
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
  const paymentMethod = body.payment_method
  const marketing = normalizeMarketingContext(body.marketing)
  const analytics = normalizeAnalyticsContext(body.analytics)
  const cart = await loadPaymentCartContext(req.scope, cartId)

  const workflowResult = await createCartPaymentAttemptWorkflow(req.scope).run({
    input: {
      cartId,
      amount: cart.amount,
      currency: cart.currency,
      paymentMethod,
      customerEmail: cart.customerEmail,
      metadata: {
        item_count: cart.itemCount,
        analytics_context: analytics,
      },
      marketing,
      items: cart.items,
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
      payment_url: attempt.payment_url,
      qr_code_url: attempt.qr_code_url,
      expires_at: attempt.expires_at,
    },
    instructions,
    claim_token: claimToken,
    marketing: marketingContext,
  })
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
