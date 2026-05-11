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
  ManualPaymentInstructions,
  DeliveryLookupResult,
  OrderLookupResult,
  PaymentAttempt,
  PaymentMethod,
  Product,
  Region,
} from "./types"

type FetchOptions = {
  method?: "GET" | "POST" | "DELETE"
  body?: Record<string, unknown>
  cache?: RequestCache
}

async function medusaFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  if (!medusaPublishableKey) {
    throw new Error("Missing NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY")
  }

  const response = await fetch(`${medusaBackendUrl}${path}`, {
    method: options.method || "GET",
    cache: options.cache || "no-store",
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": medusaPublishableKey,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Medusa request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function listProducts(): Promise<Product[]> {
  const regionId = await getDefaultRegionId()
  const templateDefinitions = await safeListProductTemplates()
  const query = new URLSearchParams({
    limit: "24",
    region_id: regionId,
    fields: "id,title,handle,description,thumbnail,metadata,type,*variants,*categories",
  })

  const data = await medusaFetch<{ products: Product[] }>(
    `/store/products?${query.toString()}`,
  )

  return mapProductsWithAvailability(data.products || [], templateDefinitions)
}

export async function retrieveProduct(handle: string): Promise<Product | null> {
  const regionId = await getDefaultRegionId()
  const templateDefinitions = await safeListProductTemplates()
  const query = new URLSearchParams({
    handle,
    region_id: regionId,
    fields: "id,title,handle,description,thumbnail,metadata,type,*variants,*categories",
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
}): Promise<{
  attempt: PaymentAttempt
  instructions: ManualPaymentInstructions
  claim_token: string
}> {
  return medusaFetch(`/store/carts/${input.cartId}/payments`, {
    method: "POST",
    body: {
      payment_method: input.paymentMethod,
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
            }
          : variant
      }),
    }, templates)
  )
}

async function safeListProductTemplates() {
  try {
    const data = await medusaFetch<{
      templates: ProductTemplateDefinition[]
    }>("/store/product-templates")

    return data.templates || []
  } catch {
    return []
  }
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
}
