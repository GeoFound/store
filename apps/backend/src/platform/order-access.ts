import type { BackendRuntimeContext } from "./backend-context"
import type {
  PlatformResolutionContext,
  VersionedPluginContract,
} from "./contracts"
import { getPlatformRuntime } from "./runtime"

export type IssueOrderAccessInput = {
  scope: BackendRuntimeContext
  orderId: string
  customerEmail: string
  purpose?: "view_order" | "claim_order"
  metadata?: Record<string, unknown> | null
  expiresAt?: Date | null
}

export type IssueOrderAccessResult = {
  token: string
  record: Record<string, unknown>
}

export interface OrderAccessProvider {
  code: string
  issueToken(
    input: IssueOrderAccessInput
  ): Promise<IssueOrderAccessResult> | IssueOrderAccessResult
  revokeActiveTokens(input: {
    scope: BackendRuntimeContext
    orderId: string
    purpose?: "view_order" | "claim_order"
  }): Promise<unknown> | unknown
}

export function registerOrderAccessProvider(
  provider: OrderAccessProvider,
  input: {
    pluginId: string
    version?: string
    priority?: number
    enabled?: boolean
    scope?: VersionedPluginContract<OrderAccessProvider>["scope"]
    description?: string
  }
) {
  getPlatformRuntime().registerContract<OrderAccessProvider>({
    capability: "order-access-provider",
    name: provider.code,
    pluginId: input.pluginId,
    version: input.version || "v1",
    implementation: provider,
    priority: input.priority,
    enabled: input.enabled,
    scope: input.scope,
    description: input.description,
  })
}

export function getOrderAccessProvider(
  code: string,
  context?: PlatformResolutionContext
) {
  return getPlatformRuntime().resolveContract<OrderAccessProvider>(
    "order-access-provider",
    code,
    context
  )
}

export function getOrderAccessProviderOrFallback(
  code: string,
  fallbackCode = "noop",
  context?: PlatformResolutionContext
) {
  return getPlatformRuntime().resolveContractOrFallback<OrderAccessProvider>(
    "order-access-provider",
    code,
    fallbackCode,
    context
  )
}
