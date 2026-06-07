import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type {
  BackendRuntimeContext,
  BackendServiceToken,
} from "../platform/backend-context"
import type { PlatformHookName } from "../platform/hooks"
import { ANALYTICS_CORE_MODULE } from "../modules/analytics-core"
import { CREDENTIAL_INVENTORY_MODULE } from "../modules/credential-inventory"
import { DIGITAL_DELIVERY_MODULE } from "../modules/digital-delivery"
import { GUEST_ORDER_ACCESS_MODULE } from "../modules/guest-order-access"
import { MARKETING_ENGINE_MODULE } from "../modules/marketing-engine"
import { SUPPORT_AUDIT_MODULE } from "../modules/support-audit"
import { SUPPLIER_PROCUREMENT_MODULE } from "../modules/supplier-procurement"

export type BackendCapabilityScope =
  | "inventory-handler"
  | "delivery-handler"
  | "order-access-provider"
  | "marketing-strategy"
  | "supplier-provider"
  | "platform-hook"

const CROSS_CUTTING_TOKENS: BackendServiceToken[] = [
  ContainerRegistrationKeys.LOGGER,
  "logger",
]

const CAPABILITY_TOKENS: Record<BackendCapabilityScope, BackendServiceToken[]> = {
  "inventory-handler": [
    ...CROSS_CUTTING_TOKENS,
    Modules.LOCKING,
    CREDENTIAL_INVENTORY_MODULE,
  ],
  "delivery-handler": [
    ...CROSS_CUTTING_TOKENS,
    CREDENTIAL_INVENTORY_MODULE,
    DIGITAL_DELIVERY_MODULE,
    SUPPORT_AUDIT_MODULE,
    SUPPLIER_PROCUREMENT_MODULE,
  ],
  "order-access-provider": [
    ...CROSS_CUTTING_TOKENS,
    GUEST_ORDER_ACCESS_MODULE,
  ],
  "marketing-strategy": [
    ...CROSS_CUTTING_TOKENS,
    Modules.LOCKING,
    MARKETING_ENGINE_MODULE,
  ],
  "supplier-provider": [...CROSS_CUTTING_TOKENS],
  "platform-hook": [
    ...CROSS_CUTTING_TOKENS,
    Modules.LOCKING,
    Modules.NOTIFICATION,
    ANALYTICS_CORE_MODULE,
    MARKETING_ENGINE_MODULE,
    SUPPORT_AUDIT_MODULE,
  ],
}

export function createInventoryHandlerScope(scope: BackendRuntimeContext) {
  return createCapabilityScope(scope, "inventory-handler")
}

export function createDeliveryHandlerScope(scope: BackendRuntimeContext) {
  return createCapabilityScope(scope, "delivery-handler")
}

export function createOrderAccessProviderScope(scope: BackendRuntimeContext) {
  return createCapabilityScope(scope, "order-access-provider")
}

export function createMarketingStrategyScope(scope: BackendRuntimeContext) {
  return createCapabilityScope(scope, "marketing-strategy")
}

export function createSupplierProviderScope(scope: BackendRuntimeContext) {
  return createCapabilityScope(scope, "supplier-provider")
}

export function createPlatformHookScope(scope: BackendRuntimeContext) {
  return createCapabilityScope(scope, "platform-hook")
}

export function restrictPlatformHookInput(
  _hook: PlatformHookName,
  input: unknown
) {
  if (!hasBackendScope(input)) {
    return input
  }

  return {
    ...input,
    scope: createPlatformHookScope(input.scope),
  }
}

function createCapabilityScope(
  scope: BackendRuntimeContext,
  capability: BackendCapabilityScope
): BackendRuntimeContext {
  const allowedTokens = new Set(CAPABILITY_TOKENS[capability])

  return {
    resolve<T = unknown>(token: BackendServiceToken): T {
      if (!allowedTokens.has(token)) {
        throw new Error(
          `Backend service token "${formatToken(token)}" is not allowed for ${capability}`
        )
      }

      return scope.resolve<T>(token)
    },
  }
}

function hasBackendScope(input: unknown): input is {
  scope: BackendRuntimeContext
} {
  if (!input || typeof input !== "object") {
    return false
  }

  const candidate = input as { scope?: BackendRuntimeContext }

  return (
    "scope" in input &&
    Boolean(candidate.scope) &&
    typeof candidate.scope?.resolve === "function"
  )
}

function formatToken(token: BackendServiceToken) {
  return typeof token === "symbol" ? token.toString() : token
}
