import type {
  PlatformResolutionContext,
  VersionedPluginContract,
} from "./contracts"
import type { BackendRuntimeContext } from "./backend-context"
import { getPlatformRuntime } from "./runtime"

export const ANALYTICS_CORE_MODULE = "analyticsCore"

export type AnalyticsEventSource = "backend_hook" | "storefront" | "system"

export type CaptureAnalyticsEventInput = {
  scope?: BackendRuntimeContext
  eventName: string
  source?: AnalyticsEventSource
  eventKey?: string | null
  occurredAt?: string | Date | null
  cartId?: string | null
  orderId?: string | null
  paymentAttemptId?: string | null
  customerEmail?: string | null
  payload?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  destinationCodes: string[]
}

export interface AnalyticsCaptureService {
  captureEvent(input: CaptureAnalyticsEventInput): Promise<unknown> | unknown
}

export type AnalyticsDestinationSendInput = {
  event: Record<string, unknown>
  dispatch: Record<string, unknown>
}

export type AnalyticsDestinationSendResult = {
  status?: number
  responseBody?: string
}

export interface AnalyticsDestination {
  code: string
  send(
    input: AnalyticsDestinationSendInput
  ):
    | Promise<AnalyticsDestinationSendResult>
    | AnalyticsDestinationSendResult
}

export type AnalyticsDispatchConfig = {
  enabled: boolean
  batchSize: number
  maxRetryAttempts: number
  retryBaseSeconds: number
  retryMaxSeconds: number
}

export function registerAnalyticsDestination(
  destination: AnalyticsDestination,
  input: {
    pluginId: string
    version?: string
    priority?: number
    enabled?: boolean
    scope?: VersionedPluginContract<AnalyticsDestination>["scope"]
    description?: string
  }
) {
  getPlatformRuntime().registerContract<AnalyticsDestination>(
    {
      capability: "analytics-destination",
      name: destination.code,
      pluginId: input.pluginId,
      version: input.version || "v1",
      implementation: destination,
      priority: input.priority,
      enabled: input.enabled,
      scope: input.scope,
      description: input.description,
    },
    input.pluginId
  )
}

export function getAnalyticsDestination(
  code: string,
  context?: PlatformResolutionContext
) {
  return getPlatformRuntime().resolveContract<AnalyticsDestination>(
    "analytics-destination",
    code,
    context
  )
}

export function listAnalyticsDestinations(
  context?: PlatformResolutionContext
) {
  const runtime = getPlatformRuntime()
  const sortedNames = runtime
    .listContracts("analytics-destination")
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))
    .map((contract) => contract.name)
  const seen = new Set<string>()
  const destinations: AnalyticsDestination[] = []

  for (const name of sortedNames) {
    if (seen.has(name)) {
      continue
    }

    seen.add(name)
    const destination = runtime.resolveContract<AnalyticsDestination>(
      "analytics-destination",
      name,
      context
    )

    if (destination) {
      destinations.push(destination)
    }
  }

  return destinations
}

export function resetAnalyticsDestinationsForTests() {
  // Contract registrations are scoped to the shared platform runtime.
  // Tests should call resetPlatformRuntimeForTests() for a full reset.
}

export function getAnalyticsDispatchConfig(
  env: Record<string, string | undefined> = process.env
): AnalyticsDispatchConfig {
  return {
    enabled: parseBoolean(env.ANALYTICS_ENABLED, true),
    batchSize: parseInteger(env.ANALYTICS_DISPATCH_BATCH_SIZE, 100, 1, 500),
    maxRetryAttempts: parseInteger(
      env.ANALYTICS_MAX_RETRY_ATTEMPTS,
      12,
      1,
      100
    ),
    retryBaseSeconds: parseInteger(
      env.ANALYTICS_RETRY_BASE_SECONDS,
      30,
      1,
      3600
    ),
    retryMaxSeconds: parseInteger(
      env.ANALYTICS_RETRY_MAX_SECONDS,
      3600,
      10,
      86400
    ),
  }
}

export function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false
  }

  return fallback
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
) {
  if (!value || !value.trim()) {
    return fallback
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback
  }

  return parsed
}
