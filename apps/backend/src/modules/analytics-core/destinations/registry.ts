import { getPlatformRuntime } from "../../../platform/runtime"

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
  pluginId: string
  send(
    input: AnalyticsDestinationSendInput
  ): Promise<AnalyticsDestinationSendResult> | AnalyticsDestinationSendResult
}

const destinations = new Map<string, AnalyticsDestination>()

export function registerAnalyticsDestination(destination: AnalyticsDestination) {
  destinations.set(destination.code, destination)
}

export function getAnalyticsDestination(code: string) {
  const destination = destinations.get(code)

  if (!destination) {
    return undefined
  }

  if (!getPlatformRuntime().isPluginEnabled(destination.pluginId)) {
    return undefined
  }

  return destination
}

export function listAnalyticsDestinations() {
  return Array.from(destinations.values()).filter((destination) =>
    getPlatformRuntime().isPluginEnabled(destination.pluginId)
  )
}

export function resetAnalyticsDestinationsForTests() {
  destinations.clear()
}
