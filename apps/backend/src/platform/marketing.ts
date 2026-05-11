import type { MedusaContainer } from "@medusajs/framework/types"
import type {
  PlatformResolutionContext,
  VersionedPluginContract,
} from "./contracts"
import { getPlatformRuntime } from "./runtime"

export type MarketingCheckoutContextInput = {
  coupon_code?: string
  referral_code?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
}

export type MarketingResolvedContext = {
  coupon?: {
    code: string
    coupon_id?: string
    campaign_code?: string | null
    offer_code?: string | null
    reservation_id?: string
  }
  referral?: {
    code: string
    referral_link_id?: string
    campaign_code?: string | null
  }
  attribution?: {
    source?: string
    medium?: string
    campaign?: string
    content?: string
    term?: string
  }
  tags?: string[]
  warnings?: string[]
  metadata?: Record<string, unknown>
}

export type MarketingStrategyResolveInput = {
  scope: MedusaContainer
  attemptId: string
  cartId: string
  amount: number
  currency: string
  customerEmail?: string | null
  context: MarketingCheckoutContextInput
  resolved: MarketingResolvedContext
}

export type MarketingStrategyAttemptEventInput = {
  scope: MedusaContainer
  attemptId: string
  orderId?: string
  customerEmail?: string | null
  context: MarketingResolvedContext
  metadata?: Record<string, unknown>
}

export interface MarketingStrategy {
  code: string
  resolve?(
    input: MarketingStrategyResolveInput
  ): Promise<MarketingResolvedContext | null | undefined> | MarketingResolvedContext | null | undefined
  onAttemptPaid?(
    input: MarketingStrategyAttemptEventInput
  ): Promise<void> | void
  onAttemptClosed?(
    input: MarketingStrategyAttemptEventInput
  ): Promise<void> | void
}

export function registerMarketingStrategy(
  strategy: MarketingStrategy,
  input: {
    pluginId: string
    version?: string
    priority?: number
    enabled?: boolean
    scope?: VersionedPluginContract<MarketingStrategy>["scope"]
    description?: string
  }
) {
  getPlatformRuntime().registerContract<MarketingStrategy>(
    {
      capability: "marketing-strategy",
      name: strategy.code,
      pluginId: input.pluginId,
      version: input.version || "v1",
      implementation: strategy,
      priority: input.priority,
      enabled: input.enabled,
      scope: input.scope,
      description: input.description,
    },
    input.pluginId
  )
}

export function getMarketingStrategy(
  code: string,
  context?: PlatformResolutionContext
) {
  return getPlatformRuntime().resolveContract<MarketingStrategy>(
    "marketing-strategy",
    code,
    context
  )
}

export function listMarketingStrategies(context?: PlatformResolutionContext) {
  const runtime = getPlatformRuntime()
  const sortedNames = runtime
    .listContracts("marketing-strategy")
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))
    .map((contract) => contract.name)

  const seen = new Set<string>()
  const strategies: MarketingStrategy[] = []

  for (const name of sortedNames) {
    if (seen.has(name)) {
      continue
    }

    seen.add(name)
    const strategy = runtime.resolveContract<MarketingStrategy>(
      "marketing-strategy",
      name,
      context
    )

    if (strategy) {
      strategies.push(strategy)
    }
  }

  return strategies
}

export async function resolveMarketingContext(
  input: MarketingStrategyResolveInput
): Promise<MarketingResolvedContext> {
  let resolved: MarketingResolvedContext = {
    tags: [],
    warnings: [],
    metadata: {},
  }

  for (const strategy of listMarketingStrategies()) {
    if (!strategy.resolve) {
      continue
    }

    const patch = await strategy.resolve({
      ...input,
      resolved,
    })

    resolved = mergeMarketingResolvedContext(resolved, patch)
  }

  return resolved
}

export async function emitMarketingAttemptPaid(input: MarketingStrategyAttemptEventInput) {
  for (const strategy of listMarketingStrategies()) {
    if (!strategy.onAttemptPaid) {
      continue
    }

    await strategy.onAttemptPaid(input)
  }
}

export async function emitMarketingAttemptClosed(
  input: MarketingStrategyAttemptEventInput
) {
  for (const strategy of listMarketingStrategies()) {
    if (!strategy.onAttemptClosed) {
      continue
    }

    await strategy.onAttemptClosed(input)
  }
}

function mergeMarketingResolvedContext(
  base: MarketingResolvedContext,
  patch?: MarketingResolvedContext | null
) {
  if (!patch) {
    return base
  }

  return {
    coupon: patch.coupon || base.coupon,
    referral: patch.referral || base.referral,
    attribution: {
      ...(base.attribution || {}),
      ...(patch.attribution || {}),
    },
    tags: dedupeStrings([...(base.tags || []), ...(patch.tags || [])]),
    warnings: dedupeStrings([...(base.warnings || []), ...(patch.warnings || [])]),
    metadata: {
      ...(base.metadata || {}),
      ...(patch.metadata || {}),
    },
  }
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}
