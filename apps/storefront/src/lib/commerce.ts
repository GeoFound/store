import type {
  AfterSale,
  AnalyticsCheckoutContext,
  Cart,
  ContentEntry,
  DeliveryLookupResult,
  ManualPaymentInstructions,
  MarketingCheckoutInput,
  MarketingResolvedContext,
  CustomerAccount,
  OrderLookupResult,
  PaymentAttempt,
  PaymentMethod,
  Product,
  Region,
} from "./types"

export type CommerceBackend = {
  listProducts(): Promise<Product[]>
  retrieveProduct(handle: string): Promise<Product | null>
  listContentEntries(input: {
    siteId: string
    limit?: number
  }): Promise<ContentEntry[]>
  retrieveContentEntry(input: {
    siteId: string
    slug: string
  }): Promise<ContentEntry | null>
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
  loginCustomerAccount(input: {
    email: string
    password: string
    turnstileToken?: string
  }): Promise<void>
  registerCustomerAccount(input: {
    firstName: string
    lastName: string
    email: string
    password: string
    turnstileToken?: string
  }): Promise<void>
  requestCustomerAccountPasswordReset(input: {
    email: string
    turnstileToken?: string
  }): Promise<void>
  confirmCustomerAccountPasswordReset(input: {
    token: string
    password: string
  }): Promise<void>
  startGoogleCustomerAccountLogin(): Promise<{ location?: string }>
  logoutCustomerAccount(): Promise<void>
  retrieveCurrentCustomerAccount(): Promise<CustomerAccount | null>
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
    instructions: ManualPaymentInstructions | null
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

type CommerceBackendLoader = () => Promise<CommerceBackend>

const commerceBackendLoaders: Record<string, CommerceBackendLoader> = {
  medusa: async () => import("./commerce-medusa"),
}

let commerceBackendPromise: Promise<CommerceBackend> | null = null

export function listCommerceBackendNames() {
  return Object.keys(commerceBackendLoaders)
}

async function resolveCommerceBackend(name: string): Promise<CommerceBackend> {
  const loader = commerceBackendLoaders[name]

  if (!loader) {
    throw new Error(
      `Unsupported commerce backend "${name}". Expected one of: ${Object.keys(
        commerceBackendLoaders
      ).join(", ")}`
    )
  }

  return loader()
}

async function getCommerceBackend() {
  commerceBackendPromise ??= resolveCommerceBackend(COMMERCE_BACKEND_NAME)
  return commerceBackendPromise
}

export async function listProducts() {
  return (await getCommerceBackend()).listProducts()
}

export async function retrieveProduct(handle: string) {
  return (await getCommerceBackend()).retrieveProduct(handle)
}

export async function listPublishedContentEntries(input: {
  siteId: string
  limit?: number
}) {
  return (await getCommerceBackend()).listContentEntries(input)
}

export async function retrievePublishedContentEntry(input: {
  siteId: string
  slug: string
}) {
  return (await getCommerceBackend()).retrieveContentEntry(input)
}

export async function listRegions() {
  return (await getCommerceBackend()).listRegions()
}

export async function getDefaultRegionId() {
  return (await getCommerceBackend()).getDefaultRegionId()
}

export async function createCart() {
  return (await getCommerceBackend()).createCart()
}

export async function retrieveCart(cartId: string) {
  return (await getCommerceBackend()).retrieveCart(cartId)
}

export async function addLineItem(input: {
  cartId: string
  variantId: string
  quantity: number
}) {
  return (await getCommerceBackend()).addLineItem(input)
}

export async function updateLineItem(input: {
  cartId: string
  lineItemId: string
  quantity: number
}) {
  return (await getCommerceBackend()).updateLineItem(input)
}

export async function deleteLineItem(input: {
  cartId: string
  lineItemId: string
}) {
  return (await getCommerceBackend()).deleteLineItem(input)
}

export async function updateCartEmail(input: {
  cartId: string
  email: string
}) {
  return (await getCommerceBackend()).updateCartEmail(input)
}

export async function loginCustomerAccount(input: {
  email: string
  password: string
  turnstileToken?: string
}) {
  return (await getCommerceBackend()).loginCustomerAccount(input)
}

export async function registerCustomerAccount(input: {
  firstName: string
  lastName: string
  email: string
  password: string
  turnstileToken?: string
}) {
  return (await getCommerceBackend()).registerCustomerAccount(input)
}

export async function requestCustomerAccountPasswordReset(input: {
  email: string
  turnstileToken?: string
}) {
  return (await getCommerceBackend()).requestCustomerAccountPasswordReset(input)
}

export async function confirmCustomerAccountPasswordReset(input: {
  token: string
  password: string
}) {
  return (await getCommerceBackend()).confirmCustomerAccountPasswordReset(input)
}

export async function startGoogleCustomerAccountLogin() {
  return (await getCommerceBackend()).startGoogleCustomerAccountLogin()
}

export async function logoutCustomerAccount() {
  return (await getCommerceBackend()).logoutCustomerAccount()
}

export async function retrieveCurrentCustomerAccount() {
  return (await getCommerceBackend()).retrieveCurrentCustomerAccount()
}

export async function listPaymentMethods(input?: {
  amount?: number
  currency?: string
}) {
  return (await getCommerceBackend()).listPaymentMethods(input)
}

export async function createCartPayment(input: {
  cartId: string
  paymentMethod: PaymentMethod["code"]
  marketing?: MarketingCheckoutInput
  analytics?: AnalyticsCheckoutContext
}) {
  return (await getCommerceBackend()).createCartPayment(input)
}

export async function retrievePaymentAttempt(id: string) {
  return (await getCommerceBackend()).retrievePaymentAttempt(id)
}

export async function claimOrderAccess(input: {
  attemptId: string
  claimToken: string
}) {
  return (await getCommerceBackend()).claimOrderAccess(input)
}

export async function retrieveDelivery(accessToken: string) {
  return (await getCommerceBackend()).retrieveDelivery(accessToken)
}

export async function confirmDelivery(accessToken: string) {
  return (await getCommerceBackend()).confirmDelivery(accessToken)
}

export async function retrieveOrder(accessToken: string) {
  return (await getCommerceBackend()).retrieveOrder(accessToken)
}

export async function confirmOrderDelivery(input: {
  accessToken: string
  deliveryId: string
}) {
  return (await getCommerceBackend()).confirmOrderDelivery(input)
}

export async function createOrderAfterSale(input: {
  accessToken: string
  deliveryId: string
  email?: string
  reason: AfterSale["reason"]
  message: string
}) {
  return (await getCommerceBackend()).createOrderAfterSale(input)
}

export async function recoverOrder(input: { email: string; orderId: string }) {
  return (await getCommerceBackend()).recoverOrder(input)
}

export async function verifyOrderRecovery(input: {
  orderId: string
  code: string
}) {
  return (await getCommerceBackend()).verifyOrderRecovery(input)
}

export async function createAfterSale(input: {
  accessToken: string
  email?: string
  reason: AfterSale["reason"]
  message: string
}) {
  return (await getCommerceBackend()).createAfterSale(input)
}
