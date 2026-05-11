import type { PaymentProvider } from "./types"
import {
  getPlatformRuntime,
  type PlatformResolutionContext,
  type VersionedPluginContract,
} from "../../../platform"

export function registerPaymentProvider(
  provider: PaymentProvider,
  input: {
    pluginId: string
    version?: string
    priority?: number
    enabled?: boolean
    scope?: VersionedPluginContract<PaymentProvider>["scope"]
    description?: string
  }
) {
  getPlatformRuntime().registerContract<PaymentProvider>({
    capability: "payment-provider",
    name: provider.code,
    pluginId: input.pluginId,
    version: input.version || "v1",
    implementation: provider,
    priority: input.priority,
    enabled: input.enabled,
    scope: input.scope,
    description: input.description,
  }, input.pluginId)
}

export function getPaymentProvider(
  code: string,
  context?: PlatformResolutionContext
) {
  return getPlatformRuntime().resolveContract<PaymentProvider>(
    "payment-provider",
    code,
    context
  )
}

export function getPaymentProviderOrFallback(
  code: string,
  fallbackCode = "noop",
  context?: PlatformResolutionContext
) {
  return getPlatformRuntime().resolveContractOrFallback<PaymentProvider>(
    "payment-provider",
    code,
    fallbackCode,
    context
  )
}

export function hasPaymentProvider(code: string) {
  return Boolean(getPaymentProvider(code))
}

export function listPaymentProviders() {
  const runtime = getPlatformRuntime()
  const sortedNames = runtime
    .listContracts("payment-provider")
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))
    .map((contract) => contract.name)
  const seen = new Set<string>()
  const providers: PaymentProvider[] = []

  for (const name of sortedNames) {
    if (seen.has(name)) {
      continue
    }

    seen.add(name)
    const provider = runtime.resolveContract<PaymentProvider>(
      "payment-provider",
      name
    )

    if (provider) {
      providers.push(provider)
    }
  }

  return providers
}

export function listPaymentProviderCodes() {
  return listPaymentProviders().map((provider) => provider.code)
}
