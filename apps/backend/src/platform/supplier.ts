import type { MedusaContainer } from "@medusajs/framework/types"
import type {
  PlatformResolutionContext,
  VersionedPluginContract,
} from "./contracts"
import { getPlatformRuntime } from "./runtime"

export type SupplierMappingSnapshot = {
  id?: string
  product_variant_id?: string
  provider_code?: string
  provider_sku?: string
  provider_product_id?: string | null
  provider_variant_id?: string | null
  region_code?: string | null
  currency?: string | null
  cost_price?: number | null
  list_price?: number | null
  metadata_json?: Record<string, unknown> | null
}

export type SupplierQuoteInput = {
  scope?: MedusaContainer
  providerSku: string
  productVariantId?: string
  quantity: number
  currency?: string | null
  regionCode?: string | null
  metadata?: Record<string, unknown>
  mapping?: SupplierMappingSnapshot | null
}

export type SupplierQuoteResult = {
  available: boolean
  providerSku?: string
  providerProductId?: string | null
  unitCost?: number | null
  currency?: string | null
  expiresAt?: Date | string | null
  raw?: Record<string, unknown> | null
}

export type SupplierProcureInput = {
  scope: MedusaContainer
  idempotencyKey: string
  providerSku: string
  productVariantId?: string
  quantity: number
  orderId?: string | null
  cartId?: string | null
  paymentAttemptId?: string | null
  orderItemId?: string | null
  customerEmail?: string | null
  currency?: string | null
  regionCode?: string | null
  metadata?: Record<string, unknown>
  mapping?: SupplierMappingSnapshot | null
}

export type SupplierProcureResult = {
  providerOrderId?: string | null
  status: "fulfilled" | "pending" | "failed"
  deliveryPayload?: Record<string, unknown> | string
  costAmount?: number | null
  costCurrency?: string | null
  raw?: Record<string, unknown> | null
  message?: string | null
  retryAfter?: Date | string | null
}

export type SupplierRetrieveInput = {
  scope: MedusaContainer
  providerOrderId: string
  providerSku?: string
  metadata?: Record<string, unknown>
  mapping?: SupplierMappingSnapshot | null
}

export type SupplierCatalogItem = {
  providerSku: string
  providerProductId?: string | null
  title?: string | null
  regionCode?: string | null
  currency?: string | null
  available?: boolean
  unitCost?: number | null
  raw?: Record<string, unknown> | null
}

export interface SupplierProvider {
  code: string
  quote?(input: SupplierQuoteInput): Promise<SupplierQuoteResult> | SupplierQuoteResult
  procure(
    input: SupplierProcureInput
  ): Promise<SupplierProcureResult> | SupplierProcureResult
  retrieveFulfillment?(
    input: SupplierRetrieveInput
  ): Promise<SupplierProcureResult> | SupplierProcureResult
  syncCatalog?(input: {
    scope: MedusaContainer
    cursor?: string | null
    metadata?: Record<string, unknown>
  }): Promise<{ items: SupplierCatalogItem[]; nextCursor?: string | null }>
}

export function registerSupplierProvider(
  provider: SupplierProvider,
  input: {
    pluginId: string
    version?: string
    priority?: number
    enabled?: boolean
    scope?: VersionedPluginContract<SupplierProvider>["scope"]
    description?: string
  }
) {
  getPlatformRuntime().registerContract<SupplierProvider>(
    {
      capability: "supplier-provider",
      name: provider.code,
      pluginId: input.pluginId,
      version: input.version || "v1",
      implementation: provider,
      priority: input.priority,
      enabled: input.enabled,
      scope: input.scope,
      description: input.description,
    },
    input.pluginId
  )
}

export function getSupplierProvider(
  code: string,
  context?: PlatformResolutionContext
) {
  return getPlatformRuntime().resolveContract<SupplierProvider>(
    "supplier-provider",
    code,
    context
  )
}

export function listSupplierProviders(context?: PlatformResolutionContext) {
  const runtime = getPlatformRuntime()
  const sortedNames = runtime
    .listContracts("supplier-provider")
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))
    .map((contract) => contract.name)
  const seen = new Set<string>()
  const providers: SupplierProvider[] = []

  for (const name of sortedNames) {
    if (seen.has(name)) {
      continue
    }

    seen.add(name)
    const provider = runtime.resolveContract<SupplierProvider>(
      "supplier-provider",
      name,
      context
    )

    if (provider) {
      providers.push(provider)
    }
  }

  return providers
}

export function hasSupplierProvider(code: string) {
  return Boolean(getSupplierProvider(code))
}
