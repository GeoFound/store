import type {
  PlatformResolutionContext,
  VersionedPluginContract,
} from "./contracts"
import { getPlatformRuntime } from "./runtime"

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
