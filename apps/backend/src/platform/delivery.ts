import type {
  PlatformResolutionContext,
  VersionedPluginContract,
} from "./contracts"
import type { BackendRuntimeContext } from "./backend-context"
import { getPlatformRuntime } from "./runtime"

export type CreateDeliveryInput = {
  scope?: BackendRuntimeContext
  deliveryId?: string
  orderId?: string
  cartId?: string
  paymentAttemptId?: string
  orderItemId?: string
  accountItemId?: string | null
  inventoryReservation?: {
    handler_code?: string
    reservation_key: string
    item_ids: string[]
    metadata?: Record<string, unknown>
  }
  productVariantId?: string
  productType?: string | null
  fulfillmentPolicyCode?: string | null
  deliveryHandlerCode?: string | null
  deliveryStatus?: "pending" | "delivered"
  deliveryPayload?: Record<string, unknown> | string
  deliveredBy?: string
  deliveryNote?: string
  metadata?: Record<string, unknown>
}

export type CreateDeliveryResult = {
  delivery: Record<string, unknown>
  accessToken: string | null
  created?: boolean
  updated?: boolean
}

export interface DeliveryHandler {
  code: string
  createDelivery(
    input: CreateDeliveryInput
  ): Promise<CreateDeliveryResult> | CreateDeliveryResult
}

export type FulfillmentPlan = {
  code: string
  deliveryHandlerCode: string
  inventoryHandlerCode?: string
  inventoryMode?: "reserve" | "consume" | "none"
}

export interface ProductFulfillmentPolicy {
  code: string
  resolvePlan(input: {
    productVariantId: string
    productType?: string | null
    metadata?: Record<string, unknown> | null
    context?: PlatformResolutionContext
  }): FulfillmentPlan | Promise<FulfillmentPlan>
}

export function registerDeliveryHandler(
  handler: DeliveryHandler,
  input: {
    pluginId: string
    version?: string
    priority?: number
    enabled?: boolean
    scope?: VersionedPluginContract<DeliveryHandler>["scope"]
    description?: string
  }
) {
  getPlatformRuntime().registerContract<DeliveryHandler>({
    capability: "delivery-handler",
    name: handler.code,
    pluginId: input.pluginId,
    version: input.version || "v1",
    implementation: handler,
    priority: input.priority,
    enabled: input.enabled,
    scope: input.scope,
    description: input.description,
  })
}

export function getDeliveryHandler(
  code: string,
  context?: PlatformResolutionContext
) {
  return getPlatformRuntime().resolveContract<DeliveryHandler>(
    "delivery-handler",
    code,
    context
  )
}

export function getDeliveryHandlerOrFallback(
  code: string,
  fallbackCode = "noop",
  context?: PlatformResolutionContext
) {
  return getPlatformRuntime().resolveContractOrFallback<DeliveryHandler>(
    "delivery-handler",
    code,
    fallbackCode,
    context
  )
}

export function registerProductFulfillmentPolicy(
  policy: ProductFulfillmentPolicy,
  input: {
    pluginId: string
    version?: string
    priority?: number
    enabled?: boolean
    scope?: VersionedPluginContract<ProductFulfillmentPolicy>["scope"]
    description?: string
  }
) {
  getPlatformRuntime().registerContract<ProductFulfillmentPolicy>({
    capability: "product-policy",
    name: policy.code,
    pluginId: input.pluginId,
    version: input.version || "v1",
    implementation: policy,
    priority: input.priority,
    enabled: input.enabled,
    scope: input.scope,
    description: input.description,
  })
}

export function getProductFulfillmentPolicy(
  code: string,
  context?: PlatformResolutionContext
) {
  return getPlatformRuntime().resolveContract<ProductFulfillmentPolicy>(
    "product-policy",
    code,
    context
  )
}

export function resolveDeliveryHandlerCode(input: {
  deliveryHandlerCode?: string | null
  metadata?: Record<string, unknown> | null
  accountItemId?: string | null
  templateDeliveryHandlerCode?: string | null
  deliveryId?: string | null
  deliveryPayload?: Record<string, unknown> | string
  defaultHandlerCode?: string
}): string {
  const explicitHandlerCode =
    toOptionalString(input.deliveryHandlerCode) ||
    toOptionalString(input.metadata?.delivery_handler_code) ||
    toOptionalString(input.metadata?.deliveryHandlerCode)

  if (explicitHandlerCode) {
    return explicitHandlerCode
  }

  if (toOptionalString(input.accountItemId)) {
    return "credential"
  }

  const templateHandlerCode = toOptionalString(input.templateDeliveryHandlerCode)
  if (templateHandlerCode) {
    return templateHandlerCode
  }

  if (toOptionalString(input.deliveryId) || typeof input.deliveryPayload !== "undefined") {
    return input.defaultHandlerCode || "manual"
  }

  return input.defaultHandlerCode || "manual"
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

export function resolveProductFulfillmentPolicy(input: {
  code?: string
  productVariantId: string
  productType?: string | null
  metadata?: Record<string, unknown> | null
  context?: PlatformResolutionContext
}) {
  const policy =
    (input.code
      ? getProductFulfillmentPolicy(input.code, input.context)
      : undefined) || getProductFulfillmentPolicy("default", input.context)

  if (!policy) {
    return undefined
  }

  return policy.resolvePlan({
    productVariantId: input.productVariantId,
    productType: input.productType ?? null,
    metadata: input.metadata ?? null,
    context: input.context,
  })
}
