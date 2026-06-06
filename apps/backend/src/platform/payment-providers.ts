import type {
  PlatformResolutionContext,
  VersionedPluginContract,
} from "./contracts"
import { getPlatformRuntime } from "./runtime"

export type PaymentMethodCode = string

export type ManualPaymentInstructions = {
  title: string
  body: string
  reference: string
}

export type CreatePaymentAttemptInput = {
  cartId: string
  amount: number
  currency: string
  paymentMethod: PaymentMethodCode
  customerEmail?: string
  metadata?: Record<string, unknown>
}

export type CreateProviderPaymentInput = {
  cartId: string
  amount: number
  currency: string
  paymentMethod: string
  customerEmail?: string
  metadata?: Record<string, unknown>
  channelConfig?: Record<string, unknown> | null
}

export type CreateProviderPaymentResult = {
  providerOrderId: string
  paymentUrl?: string | null
  qrCodeUrl?: string | null
  expiresAt?: Date | null
  responsePayload?: Record<string, unknown> | null
  instructions?: ManualPaymentInstructions
}

export type PaymentWebhookResult = {
  providerOrderId: string
  status: "paid" | "failed" | "expired"
  payload: Record<string, unknown>
}

export type PaymentWebhookContext = {
  headers?: Record<string, string | string[] | undefined>
  rawBody?: Buffer | string
}

export type PaymentQueryResult = {
  providerOrderId: string
  status: "pending" | "paid" | "failed" | "expired"
  payload?: Record<string, unknown>
}

export interface PaymentProvider {
  code: string
  createPayment(
    input: CreateProviderPaymentInput
  ): Promise<CreateProviderPaymentResult> | CreateProviderPaymentResult
  parseWebhook?(
    payload: Record<string, unknown>,
    context?: PaymentWebhookContext
  ): PaymentWebhookResult
  queryPayment?(providerOrderId: string): Promise<PaymentQueryResult>
}

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
  getPlatformRuntime().registerContract<PaymentProvider>(
    {
      capability: "payment-provider",
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

export function hasPaymentProvider(
  code: string,
  context?: PlatformResolutionContext
) {
  return Boolean(getPaymentProvider(code, context))
}

export function listPaymentProviders(context?: PlatformResolutionContext) {
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
      name,
      context
    )

    if (provider) {
      providers.push(provider)
    }
  }

  return providers
}

export function listPaymentProviderCodes(context?: PlatformResolutionContext) {
  return listPaymentProviders(context).map((provider) => provider.code)
}
