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
  return getPlatformRuntime()
    .listContracts("payment-provider")
    .filter((contract) =>
      Boolean(getPaymentProvider(contract.name))
    )
    .map((contract) => contract.implementation as PaymentProvider)
}

export function listPaymentProviderCodes() {
  return listPaymentProviders().map((provider) => provider.code)
}
