import type { FulfillmentCartItem } from "../platform/inventory"
import type {
  MarketingCheckoutContextInput,
  MarketingResolvedContext,
} from "../platform/marketing"
import type {
  ManualPaymentInstructions,
  PaymentMethodCode,
} from "../platform/payment-providers"

export type StorefrontPaymentMethodListInput = {
  amount?: number | string | null
  currency?: string | null
}

export type StorefrontPaymentMethodQuery = {
  amount?: number
  currency?: string
}

export type StorefrontPaymentChannel = {
  id: string
  code: string
  display_name: string
  type: string
  priority: number
  health_status: string
}

export type StorefrontPaymentMethod = {
  id: string
  code: string
  display_name: string
  type: string
  priority: number
  health_status: string
}

export type StorefrontPaymentRepository = {
  listAvailablePaymentChannels(
    input: StorefrontPaymentMethodQuery
  ): Promise<StorefrontPaymentChannel[]>
  loadCartPaymentContext(
    cartId: string
  ): Promise<StorefrontCartPaymentContext>
  createCartPaymentAttempt(
    input: StorefrontCreateCartPaymentAttemptInput
  ): Promise<StorefrontCreateCartPaymentAttemptResult>
}

export type StorefrontPaymentApplication = {
  listPaymentMethods(
    input?: StorefrontPaymentMethodListInput
  ): Promise<StorefrontPaymentMethod[]>
  createCartPayment(
    input: StorefrontCreateCartPaymentInput
  ): Promise<StorefrontCreateCartPaymentResult>
}

export type StorefrontCreateCartPaymentInput = {
  cartId?: string | null
  paymentMethod?: PaymentMethodCode | null
  marketing?: unknown
  analytics?: unknown
}

export type StorefrontCartPaymentContext = {
  amount: number
  currency: string
  customerEmail?: string
  itemCount: number
  items: FulfillmentCartItem[]
}

export type StorefrontCreateCartPaymentAttemptInput = {
  cartId: string
  amount: number
  currency: string
  paymentMethod: PaymentMethodCode
  customerEmail?: string
  metadata: {
    item_count: number
    analytics_context: StorefrontAnalyticsContext
  }
  marketing: MarketingCheckoutContextInput
  items: FulfillmentCartItem[]
}

export type StorefrontPaymentAttemptRecord = {
  id: string
  cart_id: string | null
  provider_order_id?: string | null
  amount: number
  currency: string
  status: string
  provider_code: string
  payment_url?: string | null
  qr_code_url?: string | null
  expires_at?: unknown
}

export type StorefrontCreateCartPaymentAttemptResult = {
  attempt: StorefrontPaymentAttemptRecord
  instructions?: ManualPaymentInstructions | null
  claimToken?: string | null
  marketingContext?: MarketingResolvedContext | null
}

export type StorefrontCreateCartPaymentResult = {
  attempt: StorefrontPaymentAttemptRecord
  instructions?: ManualPaymentInstructions | null
  claim_token?: string | null
  marketing?: MarketingResolvedContext | null
}

export type StorefrontAnalyticsContext = {
  ga_client_id?: string
  ga_session_id?: string
  page_location?: string
  page_path?: string
  referrer?: string
}

export function createStorefrontPaymentApplication(
  repository: StorefrontPaymentRepository
): StorefrontPaymentApplication {
  return {
    async listPaymentMethods(input = {}) {
      const channels = await repository.listAvailablePaymentChannels({
        amount: optionalAmount(input.amount),
        currency: optionalCurrency(input.currency),
      })

      return channels.map((channel) => ({
        id: channel.id,
        code: channel.code,
        display_name: channel.display_name,
        type: channel.type,
        priority: channel.priority,
        health_status: channel.health_status,
      }))
    },

    async createCartPayment(input) {
      const cartId = requiredText(input.cartId, "cart id")
      const cart = await repository.loadCartPaymentContext(cartId)
      const result = await repository.createCartPaymentAttempt({
        cartId,
        amount: cart.amount,
        currency: cart.currency,
        paymentMethod: requiredText(
          input.paymentMethod,
          "payment method"
        ) as PaymentMethodCode,
        customerEmail: cart.customerEmail,
        metadata: {
          item_count: cart.itemCount,
          analytics_context: normalizeAnalyticsContext(input.analytics),
        },
        marketing: normalizeMarketingContext(input.marketing),
        items: cart.items,
      })

      return {
        attempt: {
          id: result.attempt.id,
          cart_id: result.attempt.cart_id,
          provider_order_id: result.attempt.provider_order_id,
          amount: result.attempt.amount,
          currency: result.attempt.currency,
          status: result.attempt.status,
          provider_code: result.attempt.provider_code,
          payment_url: result.attempt.payment_url,
          qr_code_url: result.attempt.qr_code_url,
          expires_at: result.attempt.expires_at,
        },
        instructions: result.instructions,
        claim_token: result.claimToken,
        marketing: result.marketingContext,
      }
    },
  }
}

function optionalAmount(value: StorefrontPaymentMethodListInput["amount"]) {
  if (value === null || typeof value === "undefined" || value === "") {
    return undefined
  }

  const numberValue =
    typeof value === "number" ? value : Number(String(value).trim())

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return undefined
  }

  return numberValue
}

function optionalCurrency(value: StorefrontPaymentMethodListInput["currency"]) {
  if (value === null || typeof value === "undefined") {
    return undefined
  }

  const currency = String(value).trim().toLowerCase()

  return /^[a-z]{3}$/.test(currency) ? currency : undefined
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

function normalizeAnalyticsContext(value: unknown): StorefrontAnalyticsContext {
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

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()

  return trimmed ? trimmed.slice(0, 160) : undefined
}

function normalizeAnalyticsText(value: unknown, max: number) {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()

  return trimmed ? trimmed.slice(0, max) : undefined
}

function requiredText(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new Error(`${label} is required`)
  }

  const trimmed = value.trim()

  if (!trimmed) {
    throw new Error(`${label} is required`)
  }

  return trimmed
}
