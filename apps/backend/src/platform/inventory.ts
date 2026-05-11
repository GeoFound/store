import type { MedusaContainer } from "@medusajs/framework/types"
import type {
  PlatformResolutionContext,
  VersionedPluginContract,
} from "./contracts"
import { getPlatformRuntime } from "./runtime"

export type FulfillmentCartItem = {
  id?: string
  quantity?: unknown
  unit_price?: unknown
  variant_id?: string
  product_type?: string | null
  metadata?: Record<string, unknown> | null
  variant?: {
    id?: string
    product?: {
      type?: {
        value?: string | null
      } | null
      metadata?: Record<string, unknown> | null
    } | null
    metadata?: Record<string, unknown> | null
  }
}

export type InventoryReservation = {
  handler_code: string
  reservation_key: string
  item_ids: string[]
  metadata?: Record<string, unknown>
}

export type ReserveInventoryInput = {
  scope: MedusaContainer
  cartId: string
  attemptId: string
  item: FulfillmentCartItem
  productVariantId: string
  quantity: number
  reservationKey: string
  ttlSeconds?: number
  metadata?: Record<string, unknown>
}

export type FinalizeInventoryReservationInput = {
  scope: MedusaContainer
  reservation: InventoryReservation
  orderId: string
}

export type ReleaseInventoryReservationInput = {
  scope: MedusaContainer
  reservationKey: string
}

export type InventoryAvailability = {
  variant_id: string
  total_count: number
  available_count: number
  reserved_count: number
  sold_count: number
  locked_count: number
  is_in_stock: boolean
}

export interface InventoryHandler {
  code: string
  reserve(
    input: ReserveInventoryInput
  ): Promise<InventoryReservation[]> | InventoryReservation[]
  finalizeReservation(
    input: FinalizeInventoryReservationInput
  ): Promise<void> | void
  releaseReservation?(
    input: ReleaseInventoryReservationInput
  ): Promise<unknown> | unknown
  listAvailability?(input: {
    scope: MedusaContainer
    variantIds: string[]
  }): Promise<InventoryAvailability[]> | InventoryAvailability[]
}

export function registerInventoryHandler(
  handler: InventoryHandler,
  input: {
    pluginId: string
    version?: string
    priority?: number
    enabled?: boolean
    scope?: VersionedPluginContract<InventoryHandler>["scope"]
    description?: string
  }
) {
  getPlatformRuntime().registerContract<InventoryHandler>({
    capability: "inventory-handler",
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

export function getInventoryHandler(
  code: string,
  context?: PlatformResolutionContext
) {
  return getPlatformRuntime().resolveContract<InventoryHandler>(
    "inventory-handler",
    code,
    context
  )
}

export function listInventoryHandlers(context?: PlatformResolutionContext) {
  const runtime = getPlatformRuntime()
  const sortedNames = runtime
    .listContracts("inventory-handler")
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))
    .map((contract) => contract.name)
  const seen = new Set<string>()
  const handlers: InventoryHandler[] = []

  for (const name of sortedNames) {
    if (seen.has(name)) {
      continue
    }

    seen.add(name)
    const handler = runtime.resolveContract<InventoryHandler>(
      "inventory-handler",
      name,
      context
    )

    if (handler) {
      handlers.push(handler)
    }
  }

  return handlers
}

export function getCartItemVariantId(item: FulfillmentCartItem) {
  if (typeof item.variant_id === "string" && item.variant_id.trim()) {
    return item.variant_id
  }

  if (item.variant?.id) {
    return item.variant.id
  }

  throw new Error("Cart item is missing variant_id")
}

export function getCartItemProductType(item: FulfillmentCartItem) {
  return (
    toOptionalString(item.product_type) ||
    toOptionalString(item.variant?.product?.type?.value) ||
    toOptionalString(item.metadata?.product_type) ||
    toOptionalString(item.metadata?.productType) ||
    null
  )
}

export function getCartItemMetadata(item: FulfillmentCartItem) {
  return {
    ...(normalizeRecord(item.variant?.product?.metadata)),
    ...(normalizeRecord(item.variant?.metadata)),
    ...(normalizeRecord(item.metadata)),
  }
}

export function normalizeFulfillmentQuantity(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return normalizeFulfillmentQuantity(record.value)
  }

  return 0
}

function normalizeRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
