import {
  getAnalyticsDestination,
  registerAnalyticsDestination,
} from "../analytics-core/destinations/registry"
import { getGa4BackendConfig } from "./config"
import {
  buildGa4MeasurementProtocolPayload,
  createFallbackClientId,
} from "./payload"

let registered = false

export function ensureAnalyticsGa4DestinationRegistered() {
  if (registered) {
    return
  }

  registerAnalyticsDestination({
    code: "ga4",
    pluginId: "analytics-ga4",
    send: async ({ event }) => {
      const config = getGa4BackendConfig()

      if (!config.enabled) {
        throw new Error("GA4 destination is not configured")
      }

      const body = buildGa4MeasurementProtocolPayload({
        event,
        fallbackClientId: createFallbackClientId(event),
      })

      const response = await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
          config.measurementId
        )}&api_secret=${encodeURIComponent(config.apiSecret)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      )

      if (!response.ok) {
        throw new Error(
          `GA4 dispatch failed with status ${response.status}: ${
            (await response.text()).slice(0, 500) || "empty response"
          }`
        )
      }

      return {
        status: response.status,
        responseBody: "",
      }
    },
  })

  registered = true
}

export function isAnalyticsGa4DestinationAvailable() {
  ensureAnalyticsGa4DestinationRegistered()

  return Boolean(getAnalyticsDestination("ga4"))
}

export function resetAnalyticsGa4DestinationForTests() {
  registered = false
}
