import * as medusaCommerceBackend from "./commerce-medusa"
import type {
  AfterSale,
  AnalyticsCheckoutContext,
  Cart,
  DeliveryLookupResult,
  ManualPaymentInstructions,
  MarketingCheckoutInput,
  MarketingResolvedContext,
  OrderLookupResult,
  PaymentAttempt,
  PaymentMethod,
  Product,
  Region,
} from "./types"

export type CommerceBackend = {
  listProducts(): Promise<Product[]>
  retrieveProduct(handle: string): Promise<Product | null>
  listRegions(): Promise<Region[]>
  getDefaultRegionId(): Promise<string>
  createCart(): Promise<Cart>
  retrieveCart(cartId: string): Promise<Cart>
  addLineItem(input: {
    cartId: string
    variantId: string
    quantity: number
  }): Promise<Cart>
  updateLineItem(input: {
    cartId: string
    lineItemId: string
    quantity: number
  }): Promise<Cart>
  deleteLineItem(input: {
    cartId: string
    lineItemId: string
  }): Promise<Cart>
  updateCartEmail(input: {
    cartId: string
    email: string
  }): Promise<Cart>
  listPaymentMethods(input?: {
    amount?: number
    currency?: string
  }): Promise<PaymentMethod[]>
  createCartPayment(input: {
    cartId: string
    paymentMethod: PaymentMethod["code"]
    marketing?: MarketingCheckoutInput
    analytics?: AnalyticsCheckoutContext
  }): Promise<{
    attempt: PaymentAttempt
    instructions: ManualPaymentInstructions
    claim_token: string
    marketing?: MarketingResolvedContext
  }>
  retrievePaymentAttempt(id: string): Promise<{ attempt: PaymentAttempt }>
  claimOrderAccess(input: {
    attemptId: string
    claimToken: string
  }): Promise<{ order_id: string; access_token: string }>
  retrieveDelivery(accessToken: string): Promise<DeliveryLookupResult>
  confirmDelivery(
    accessToken: string
  ): Promise<{ delivery: DeliveryLookupResult["delivery"] }>
  retrieveOrder(accessToken: string): Promise<OrderLookupResult>
  confirmOrderDelivery(input: {
    accessToken: string
    deliveryId: string
  }): Promise<{ delivery: DeliveryLookupResult["delivery"] }>
  createOrderAfterSale(input: {
    accessToken: string
    deliveryId: string
    email?: string
    reason: AfterSale["reason"]
    message: string
  }): Promise<{ after_sale: AfterSale }>
  recoverOrder(input: {
    email: string
    orderId: string
  }): Promise<{ order_id: string; expires_at?: string | null }>
  verifyOrderRecovery(input: {
    orderId: string
    code: string
  }): Promise<{ order_id: string; access_token: string }>
  createAfterSale(input: {
    accessToken: string
    email?: string
    reason: AfterSale["reason"]
    message: string
  }): Promise<{ after_sale: AfterSale }>
}

const COMMERCE_BACKEND_NAME =
  process.env.NEXT_PUBLIC_COMMERCE_BACKEND?.trim() || "medusa"

const commerceBackends: Record<string, CommerceBackend> = {
  medusa: medusaCommerceBackend,
}

const commerceBackend = resolveCommerceBackend(COMMERCE_BACKEND_NAME)

function resolveCommerceBackend(name: string): CommerceBackend {
  const backend = commerceBackends[name]

  if (!backend) {
    throw new Error(
      `Unsupported commerce backend "${name}". Expected one of: ${Object.keys(
        commerceBackends
      ).join(", ")}`
    )
  }

  return backend
}

export const listProducts = commerceBackend.listProducts
export const retrieveProduct = commerceBackend.retrieveProduct
export const listRegions = commerceBackend.listRegions
export const getDefaultRegionId = commerceBackend.getDefaultRegionId
export const createCart = commerceBackend.createCart
export const retrieveCart = commerceBackend.retrieveCart
export const addLineItem = commerceBackend.addLineItem
export const updateLineItem = commerceBackend.updateLineItem
export const deleteLineItem = commerceBackend.deleteLineItem
export const updateCartEmail = commerceBackend.updateCartEmail
export const listPaymentMethods = commerceBackend.listPaymentMethods
export const createCartPayment = commerceBackend.createCartPayment
export const retrievePaymentAttempt = commerceBackend.retrievePaymentAttempt
export const claimOrderAccess = commerceBackend.claimOrderAccess
export const retrieveDelivery = commerceBackend.retrieveDelivery
export const confirmDelivery = commerceBackend.confirmDelivery
export const retrieveOrder = commerceBackend.retrieveOrder
export const confirmOrderDelivery = commerceBackend.confirmOrderDelivery
export const createOrderAfterSale = commerceBackend.createOrderAfterSale
export const recoverOrder = commerceBackend.recoverOrder
export const verifyOrderRecovery = commerceBackend.verifyOrderRecovery
export const createAfterSale = commerceBackend.createAfterSale
