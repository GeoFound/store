import {
  medusaBackendUrl,
  medusaPublishableKey,
  storefrontRegionId,
} from "./config"
import {
  resolveProductTemplate,
  type ProductTemplateDefinition,
} from "./product-templates"
import type {
  Cart,
  AfterSale,
  AccountOrder,
  ContentEntry,
  CustomerAccount,
  ManualPaymentInstructions,
  DeliveryLookupResult,
  OrderLookupResult,
  PaymentAttempt,
  PaymentMethod,
  MarketingCheckoutInput,
  AnalyticsCheckoutContext,
  MarketingResolvedContext,
  Product,
  Region,
  SeoDocument,
} from "./types"

type FetchOptions = {
  method?: "GET" | "POST" | "DELETE"
  body?: unknown
  cache?: RequestCache
  token?: string
  publishable?: boolean
}

type StorefrontFetchOptions = {
  method?: "GET" | "POST" | "DELETE"
  body?: unknown
  cache?: RequestCache
}

type TokenResponse = {
  token: string
}

type CustomerResponse = {
  customer: CustomerAccount
}

type AccountOrdersResponse = {
  customer: CustomerAccount
  orders: AccountOrder[]
}

async function medusaFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  const usePublishable = options.publishable ?? path.startsWith("/store")

  if (usePublishable) {
    if (!medusaPublishableKey) {
      throw new Error("Missing NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY")
    }

    headers["x-publishable-api-key"] = medusaPublishableKey
  }

  if (options.token) {
    headers.authorization = `Bearer ${options.token}`
  }

  const response = await fetch(`${medusaBackendUrl}${path}`, {
    method: options.method || "GET",
    cache: options.cache || "no-store",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    throw new Error(
      await readResponseError(response, `Medusa request failed: ${response.status}`)
    )
  }

  return response.json() as Promise<T>
}

async function storefrontFetch<T>(
  path: string,
  options: StorefrontFetchOptions = {},
): Promise<T> {
  const response = await fetch(path, {
    method: options.method || "GET",
    cache: options.cache || "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    throw new Error(
      await readResponseError(response, `Storefront request failed: ${response.status}`)
    )
  }

  return response.json() as Promise<T>
}

export async function listProducts(): Promise<Product[]> {
  const [regionId, templateDefinitions] = await Promise.all([
    getDefaultRegionId(),
    listProductTemplates(),
  ])
  const query = new URLSearchParams({
    limit: "48",
    region_id: regionId,
    fields: "id,title,handle,description,thumbnail,created_at,updated_at,metadata,type,*variants,*categories",
  })

  const data = await medusaFetch<{ products: Product[] }>(
    `/store/products?${query.toString()}`,
  )

  return mapProductsWithAvailability(data.products || [], templateDefinitions)
}

export async function retrieveProduct(handle: string): Promise<Product | null> {
  const [regionId, templateDefinitions] = await Promise.all([
    getDefaultRegionId(),
    listProductTemplates(),
  ])
  const query = new URLSearchParams({
    handle,
    region_id: regionId,
    fields: "id,title,handle,description,thumbnail,created_at,updated_at,metadata,type,*variants,*categories",
  })

  const data = await medusaFetch<{ products: Product[] }>(
    `/store/products?${query.toString()}`,
  )

  const products = await mapProductsWithAvailability(
    data.products || [],
    templateDefinitions
  )

  return products[0] || null
}

export async function listContentEntries(input: {
  siteId: string
  limit?: number
}): Promise<ContentEntry[]> {
  const query = new URLSearchParams({
    site_id: input.siteId,
    limit: String(input.limit || 100),
  })
  const data = await medusaFetch<{ entries: ContentEntry[] }>(
    `/store/content/entries?${query.toString()}`
  )

  return data.entries || []
}

export async function retrieveContentEntry(input: {
  siteId: string
  slug: string
}): Promise<ContentEntry | null> {
  const query = new URLSearchParams({
    site_id: input.siteId,
  })
  const data = await medusaFetch<{ entry?: ContentEntry }>(
    `/store/content/entries/${encodeURIComponent(input.slug)}?${query.toString()}`
  )

  return data.entry || null
}

export async function retrieveSeoDocument(input: {
  entityType: string
  entityId: string
  siteId: string
  language?: string
}): Promise<SeoDocument | null> {
  const query = new URLSearchParams({
    entity_type: input.entityType,
    entity_id: input.entityId,
    site_id: input.siteId,
  })
  if (input.language) {
    query.set("language", input.language)
  }
  const data = await medusaFetch<{ seo?: SeoDocument | null }>(
    `/store/content/seo?${query.toString()}`
  )

  return data.seo || null
}

export async function listRegions(): Promise<Region[]> {
  const data = await medusaFetch<{ regions: Region[] }>("/store/regions")

  return data.regions || []
}

export async function getDefaultRegionId(): Promise<string> {
  if (storefrontRegionId) {
    return storefrontRegionId
  }

  const regions = await listRegions()
  const region = regions[0]

  if (!region) {
    throw new Error("No Medusa region configured")
  }

  return region.id
}

export async function createCart(): Promise<Cart> {
  const regionId = await getDefaultRegionId()
  const data = await medusaFetch<{ cart: Cart }>("/store/carts", {
    method: "POST",
    body: {
      region_id: regionId,
    },
  })

  return data.cart
}

export async function retrieveCart(cartId: string): Promise<Cart> {
  const data = await medusaFetch<{ cart: Cart }>(`/store/carts/${cartId}`)

  return data.cart
}

export async function addLineItem(input: {
  cartId: string
  variantId: string
  quantity: number
}): Promise<Cart> {
  const data = await medusaFetch<{ cart: Cart }>(
    `/store/carts/${input.cartId}/line-items`,
    {
      method: "POST",
      body: {
        variant_id: input.variantId,
        quantity: input.quantity,
      },
    },
  )

  return data.cart
}

export async function updateLineItem(input: {
  cartId: string
  lineItemId: string
  quantity: number
}): Promise<Cart> {
  const data = await medusaFetch<{ cart: Cart }>(
    `/store/carts/${input.cartId}/line-items/${input.lineItemId}`,
    {
      method: "POST",
      body: {
        quantity: input.quantity,
      },
    },
  )

  return data.cart
}

export async function deleteLineItem(input: {
  cartId: string
  lineItemId: string
}): Promise<Cart> {
  const data = await medusaFetch<{ cart: Cart }>(
    `/store/carts/${input.cartId}/line-items/${input.lineItemId}`,
    {
      method: "DELETE",
    },
  )

  return data.cart
}

export async function updateCartEmail(input: {
  cartId: string
  email: string
}): Promise<Cart> {
  const data = await medusaFetch<{ cart: Cart }>(
    `/store/carts/${input.cartId}`,
    {
      method: "POST",
      body: {
        email: input.email,
      },
    },
  )

  return data.cart
}

export async function loginCustomerAccount(input: {
  email: string
  password: string
  turnstileToken?: string
}): Promise<void> {
  await storefrontFetch<{ ok: boolean }>("/api/account/login", {
    method: "POST",
    body: {
      email: input.email,
      password: input.password,
      turnstile_token: input.turnstileToken || undefined,
    },
  })
}

export async function registerCustomerAccount(input: {
  firstName: string
  lastName: string
  email: string
  password: string
  turnstileToken?: string
}): Promise<void> {
  await storefrontFetch<{ ok: boolean }>("/api/account/register", {
    method: "POST",
    body: {
      email: input.email,
      password: input.password,
      first_name: input.firstName,
      last_name: input.lastName,
      turnstile_token: input.turnstileToken || undefined,
    },
  })
}

export async function requestCustomerAccountPasswordReset(input: {
  email: string
  turnstileToken?: string
}): Promise<void> {
  await storefrontFetch<{ ok: boolean }>("/api/account/password-reset/request", {
    method: "POST",
    body: {
      email: input.email,
      turnstile_token: input.turnstileToken || undefined,
    },
  })
}

export async function confirmCustomerAccountPasswordReset(input: {
  token: string
  password: string
}): Promise<void> {
  await storefrontFetch<{ ok: boolean }>("/api/account/password-reset/confirm", {
    method: "POST",
    body: {
      token: input.token,
      password: input.password,
    },
  })
}

export async function startGoogleCustomerAccountLogin(): Promise<{
  location?: string
}> {
  return storefrontFetch("/api/account/google/start", {
    method: "POST",
  })
}

export async function logoutCustomerAccount(): Promise<void> {
  await storefrontFetch<{ ok: boolean }>("/api/account/logout", {
    method: "POST",
  })
}

export async function retrieveCurrentCustomerAccount(): Promise<CustomerAccount | null> {
  const response = await fetch("/api/account/me", {
    cache: "no-store",
  }).catch(() => null)

  if (!response || response.status === 401) {
    return null
  }

  if (!response.ok) {
    throw new Error(
      await readResponseError(response, `Storefront request failed: ${response.status}`)
    )
  }

  const data = (await response.json()) as { customer?: CustomerAccount }

  return data.customer || null
}

export async function loginCustomerAccountWithMedusa(input: {
  email: string
  password: string
}) {
  const { token } = await medusaFetch<TokenResponse>("/auth/customer/emailpass", {
    method: "POST",
    body: {
      email: input.email,
      password: input.password,
    },
    publishable: false,
  })

  return token
}

export async function registerCustomerAccountWithMedusa(input: {
  firstName: string
  lastName: string
  email: string
  password: string
}) {
  let token = ""

  try {
    const registered = await medusaFetch<TokenResponse>(
      "/auth/customer/emailpass/register",
      {
        method: "POST",
        body: {
          email: input.email,
          password: input.password,
        },
        publishable: false,
      }
    )
    token = registered.token
  } catch (error) {
    if (!isExistingIdentityError(error)) {
      throw error
    }

    token = await loginCustomerAccountWithMedusa({
      email: input.email,
      password: input.password,
    })
  }

  if (decodeJwtPayload(token).actor_id) {
    return token
  }

  await createCustomerForTokenWithMedusa(token, {
    email: input.email,
    first_name: input.firstName,
    last_name: input.lastName,
  })

  return refreshCustomerTokenWithMedusa(token)
}

export async function startGoogleCustomerLoginWithMedusa(callbackUrl: string) {
  return medusaFetch<{ location?: string; token?: string }>(
    "/auth/customer/google",
    {
      method: "POST",
      body: {
        callback_url: callbackUrl,
      },
      publishable: false,
    }
  )
}

export async function completeGoogleCustomerLoginWithMedusa(input: {
  query: URLSearchParams
}) {
  const body = Object.fromEntries(input.query.entries())
  const { token } = await medusaFetch<TokenResponse>(
    "/auth/customer/google/callback",
    {
      method: "POST",
      body,
      publishable: false,
    }
  )

  if (decodeJwtPayload(token).actor_id) {
    return token
  }

  const metadata = readJwtObject(decodeJwtPayload(token).user_metadata)
  const email = readString(metadata.email)

  if (!email) {
    throw new Error("Google account did not return a verified email.")
  }

  await createCustomerForTokenWithMedusa(token, {
    email,
    first_name: readString(metadata.given_name),
    last_name: readString(metadata.family_name),
  })

  return refreshCustomerTokenWithMedusa(token)
}

export async function retrieveCustomerAccountWithMedusa(token: string) {
  const data = await medusaFetch<CustomerResponse>("/store/customers/me", {
    token,
  })

  return data.customer
}

export async function listCustomerAccountOrdersWithMedusa(token: string) {
  const data = await medusaFetch<AccountOrdersResponse>("/store/account/orders", {
    token,
  })

  return data.orders || []
}

export async function requestCustomerPasswordResetWithMedusa(input: {
  email: string
  resetUrl: string
}) {
  await medusaEmptyFetch("/auth/customer/emailpass/reset-password", {
    method: "POST",
    publishable: false,
    accept: "text/plain",
    body: {
      identifier: input.email,
      metadata: {
        reset_password_url: input.resetUrl,
        resetPasswordUrl: input.resetUrl,
        actor: "customer",
      },
    },
  })
}

export async function confirmCustomerPasswordResetWithMedusa(input: {
  token: string
  password: string
}) {
  await medusaEmptyFetch("/auth/customer/emailpass/update", {
    method: "POST",
    publishable: false,
    token: input.token,
    body: {
      password: input.password,
    },
  })
}

export async function listPaymentMethods(input?: {
  amount?: number
  currency?: string
}): Promise<PaymentMethod[]> {
  const query = new URLSearchParams()

  if (typeof input?.amount === "number") {
    query.set("amount", String(input.amount))
  }

  if (input?.currency) {
    query.set("currency", input.currency)
  }

  const suffix = query.size ? `?${query.toString()}` : ""
  const data = await medusaFetch<{ methods: PaymentMethod[] }>(
    `/store/payment-methods${suffix}`,
  )

  return data.methods
}

export async function createCartPayment(input: {
  cartId: string
  paymentMethod: PaymentMethod["code"]
  marketing?: MarketingCheckoutInput
  analytics?: AnalyticsCheckoutContext
}): Promise<{
  attempt: PaymentAttempt
  instructions: ManualPaymentInstructions | null
  claim_token: string
  marketing?: MarketingResolvedContext
}> {
  return medusaFetch(`/store/carts/${input.cartId}/payments`, {
    method: "POST",
    body: {
      payment_method: input.paymentMethod,
      marketing: input.marketing || {},
      analytics: input.analytics || {},
    },
  })
}

export async function retrievePaymentAttempt(
  id: string,
): Promise<{ attempt: PaymentAttempt }> {
  return medusaFetch(`/store/payment-attempts/${encodeURIComponent(id)}`)
}

export async function claimOrderAccess(input: {
  attemptId: string
  claimToken: string
}): Promise<{ order_id: string; access_token: string }> {
  return medusaFetch(
    `/store/payment-attempts/${encodeURIComponent(input.attemptId)}/claim-order-access`,
    {
      method: "POST",
      body: {
        claim_token: input.claimToken,
      },
    },
  )
}

export async function retrieveDelivery(
  accessToken: string,
): Promise<DeliveryLookupResult> {
  return medusaFetch(`/store/deliveries/${encodeURIComponent(accessToken)}`)
}

export async function confirmDelivery(
  accessToken: string,
): Promise<{ delivery: DeliveryLookupResult["delivery"] }> {
  return medusaFetch(
    `/store/deliveries/${encodeURIComponent(accessToken)}/confirm`,
    {
      method: "POST",
    },
  )
}

export async function retrieveOrder(
  accessToken: string,
): Promise<OrderLookupResult> {
  return medusaFetch(`/store/order-access/${encodeURIComponent(accessToken)}`)
}

export async function confirmOrderDelivery(input: {
  accessToken: string
  deliveryId: string
}): Promise<{ delivery: DeliveryLookupResult["delivery"] }> {
  return medusaFetch(
    `/store/order-access/${encodeURIComponent(input.accessToken)}/deliveries/${encodeURIComponent(input.deliveryId)}/confirm`,
    {
      method: "POST",
    },
  )
}

export async function createOrderAfterSale(input: {
  accessToken: string
  deliveryId: string
  email?: string
  reason: AfterSale["reason"]
  message: string
}): Promise<{ after_sale: AfterSale }> {
  return medusaFetch(
    `/store/order-access/${encodeURIComponent(input.accessToken)}/deliveries/${encodeURIComponent(input.deliveryId)}/after-sales`,
    {
      method: "POST",
      body: {
        email: input.email,
        reason: input.reason,
        message: input.message,
      },
    },
  )
}

export async function recoverOrder(input: {
  email: string
  orderId: string
}): Promise<{ order_id: string; expires_at?: string | null }> {
  return medusaFetch("/store/orders/recover", {
    method: "POST",
    body: {
      email: input.email,
      order_id: input.orderId,
    },
  })
}

export async function verifyOrderRecovery(input: {
  orderId: string
  code: string
}): Promise<{ order_id: string; access_token: string }> {
  return medusaFetch("/store/orders/recover/verify", {
    method: "POST",
    body: {
      order_id: input.orderId,
      code: input.code,
    },
  })
}

export async function createAfterSale(input: {
  accessToken: string
  email?: string
  reason: AfterSale["reason"]
  message: string
}): Promise<{ after_sale: AfterSale }> {
  return medusaFetch(
    `/store/deliveries/${encodeURIComponent(input.accessToken)}/after-sales`,
    {
      method: "POST",
      body: {
        email: input.email,
        reason: input.reason,
        message: input.message,
      },
    },
  )
}

async function createCustomerForTokenWithMedusa(
  token: string,
  input: {
    email: string
    first_name?: string
    last_name?: string
  }
) {
  return medusaFetch<CustomerResponse>("/store/customers", {
    method: "POST",
    token,
    body: {
      email: input.email,
      first_name: input.first_name || undefined,
      last_name: input.last_name || undefined,
    },
  })
}

async function refreshCustomerTokenWithMedusa(token: string) {
  const refreshed = await medusaFetch<TokenResponse>("/auth/token/refresh", {
    method: "POST",
    token,
    publishable: false,
  })

  return refreshed.token
}

async function readResponseError(response: Response, fallback: string) {
  const text = await response.text()

  if (!text) {
    return fallback
  }

  try {
    const data = JSON.parse(text) as {
      message?: string
      error?: string
      type?: string
    }

    return data.message || data.error || text
  } catch {
    return text
  }
}

async function medusaEmptyFetch(
  path: string,
  options: FetchOptions & { accept?: string } = {}
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: options.accept || "application/json",
  }
  const usePublishable = options.publishable ?? path.startsWith("/store")

  if (usePublishable) {
    if (!medusaPublishableKey) {
      throw new Error("Missing NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY")
    }

    headers["x-publishable-api-key"] = medusaPublishableKey
  }

  if (options.token) {
    headers.authorization = `Bearer ${options.token}`
  }

  const response = await fetch(`${medusaBackendUrl}${path}`, {
    method: options.method || "GET",
    cache: options.cache || "no-store",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    throw new Error(
      await readResponseError(response, `Medusa request failed: ${response.status}`)
    )
  }
}

function isExistingIdentityError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  return message.toLowerCase().includes("identity with email already exists")
}

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1]

  if (!payload) {
    return {} as Record<string, unknown>
  }

  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  )

  try {
    const bytes = Uint8Array.from(globalThis.atob(padded), (char) =>
      char.charCodeAt(0)
    )

    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
  } catch {
    return {}
  }
}

function readJwtObject(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function mapProductTemplate(
  product: Product,
  templates?: ProductTemplateDefinition[]
): Product {
  const template = resolveProductTemplate({
    metadata:
      product.metadata && typeof product.metadata === "object"
        ? product.metadata
        : null,
    productType: product.type?.value || null,
  }, templates)
  const requiresInventory = requiresCredentialInventory({
    ...product,
    template,
  })
  const variants = product.variants || []
  const isSoldOut =
    Boolean(requiresInventory) &&
    (!variants.length || variants.every(isVariantOutOfStock))

  return {
    ...product,
    isSoldOut,
    template,
  }
}

async function mapProductsWithAvailability(
  products: Product[],
  templates?: ProductTemplateDefinition[]
) {
  const variantIds = products
    .flatMap((product) => product.variants || [])
    .map((variant) => variant.id)
    .filter(Boolean)

  const availabilityByVariantId = await retrieveVariantAvailability(variantIds)

  return products.map((product) =>
    mapProductTemplate({
      ...product,
      variants: (product.variants || []).map((variant) => {
        const availability = availabilityByVariantId.get(variant.id)

        return availability
          ? {
              ...variant,
              available_quantity: availability.available_count,
              reserved_quantity: availability.reserved_count,
              sold_quantity: availability.sold_count,
              is_in_stock: availability.is_in_stock,
              purchase_available: availability.purchase_available,
              is_backorderable: availability.backorderable,
              availability_policy: availability.availability_policy,
            }
          : variant
      }),
    }, templates)
  )
}

async function listProductTemplates() {
  const data = await medusaFetch<{
    templates: ProductTemplateDefinition[]
  }>("/store/product-templates")

  return data.templates || []
}

async function retrieveVariantAvailability(variantIds: string[]) {
  const uniqueVariantIds = Array.from(new Set(variantIds.filter(Boolean)))

  if (!uniqueVariantIds.length) {
    return new Map<string, VariantAvailability>()
  }

  const query = new URLSearchParams({
    variant_ids: uniqueVariantIds.join(","),
  })
  const data = await medusaFetch<{ availability: VariantAvailability[] }>(
    `/store/product-availability?${query.toString()}`,
  )

  return new Map(
    (data.availability || []).map((item) => [item.variant_id, item] as const)
  )
}

function requiresCredentialInventory(product: Product) {
  const templateCode = product.template?.code
  const productType = product.type?.value || product.template?.productType
  const inventoryHandler = product.template?.inventoryHandlerCode

  if (inventoryHandler) {
    return inventoryHandler !== "noop"
  }

  return ["credential", "account", "license", "code"].includes(
    String(templateCode || productType || "")
  )
}

function isVariantOutOfStock(variant: NonNullable<Product["variants"]>[number]) {
  if (typeof variant.purchase_available === "boolean") {
    return !variant.purchase_available
  }

  return variant.is_in_stock === false || !variant.available_quantity
}

type VariantAvailability = {
  variant_id: string
  total_count: number
  available_count: number
  reserved_count: number
  sold_count: number
  locked_count: number
  is_in_stock: boolean
  purchase_available?: boolean
  backorderable?: boolean
  availability_policy?: string
}
