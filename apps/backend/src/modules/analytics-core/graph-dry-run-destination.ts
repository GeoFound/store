import {
  getAnalyticsDestination,
  registerAnalyticsDestination,
} from "../../platform/analytics"
import {
  exportAnalyticsEventToGraphRawSourceEvent,
  type GraphRawSourceEventRecord,
  type StoreAnalyticsEventForGraph,
} from "./graph-exporter"
import { getGraphDryRunConfig } from "./graph-dry-run-config"

export const GRAPH_DRY_RUN_DESTINATION_CODE = "graph_dry_run"

type GraphDryRunRequest = {
  request_id: string
  tenant_id: string
  product_id: string
  manifest_id: string
  dry_run: boolean
  production_write_enabled: boolean
  human_gate_approved: boolean
  trace_id: string
  idempotency_key: string
  events: GraphRawSourceEventRecord[]
}

let registered = false

export function ensureGraphDryRunDestinationRegistered() {
  if (registered) {
    return
  }

  registerAnalyticsDestination(
    {
      code: GRAPH_DRY_RUN_DESTINATION_CODE,
      send: async ({ event, dispatch }) => {
        const config = getGraphDryRunConfig()

        if (!config.enabled) {
          throw new Error("Graph dry-run destination is not configured")
        }

        const sourceEvent = exportAnalyticsEventToGraphRawSourceEvent(
          event as StoreAnalyticsEventForGraph,
          {
            tenantId: config.tenantId,
            productId: config.productId,
            defaultCountry: config.defaultCountry,
            defaultLanguage: config.defaultLanguage,
            defaultChannel: config.defaultChannel,
            defaultPlatform: config.defaultPlatform,
          }
        )

        if (!sourceEvent) {
          throw new Error(
            `Graph dry-run cannot export unsupported analytics event ${String(
              event.event_name || "unknown"
            )}`
          )
        }

        const request = buildDryRunRequest({
          dispatch,
          sourceEvent,
          tenantId: config.tenantId,
          productId: config.productId,
          manifestId: config.manifestId,
          productionWriteEnabled: config.productionWriteEnabled,
          humanGateApproved: config.humanGateApproved,
        })
        const response = await fetch(config.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Trace-Id": request.trace_id,
            "Idempotency-Key": request.idempotency_key,
          },
          body: JSON.stringify(request),
        })
        const responseBody = await response.text()

        if (!response.ok) {
          throw new Error(
            `Graph dry-run dispatch failed with status ${response.status}: ${
              responseBody.slice(0, 500) || "empty response"
            }`
          )
        }

        return {
          status: response.status,
          responseBody,
        }
      },
    },
    {
      pluginId: "analytics-core",
      version: "v1",
      priority: 90,
      enabled: true,
      description: "Graph source-event dry-run dispatch destination.",
    }
  )

  registered = true
}

export function isGraphDryRunDestinationAvailable() {
  ensureGraphDryRunDestinationRegistered()

  return Boolean(getAnalyticsDestination(GRAPH_DRY_RUN_DESTINATION_CODE))
}

export function resetGraphDryRunDestinationForTests() {
  registered = false
}

function buildDryRunRequest(input: {
  dispatch: Record<string, unknown>
  sourceEvent: GraphRawSourceEventRecord
  tenantId: string
  productId: string
  manifestId: string
  productionWriteEnabled: false
  humanGateApproved: false
}): GraphDryRunRequest {
  const dispatchId = toText(input.dispatch.id) || "unknown-dispatch"

  return {
    request_id: `store-runtime-graph-dry-run:${dispatchId}`,
    tenant_id: input.tenantId,
    product_id: input.productId,
    manifest_id: input.manifestId,
    dry_run: true,
    production_write_enabled: input.productionWriteEnabled,
    human_gate_approved: input.humanGateApproved,
    trace_id: input.sourceEvent.trace_id,
    idempotency_key: input.sourceEvent.idempotency_key,
    events: [input.sourceEvent],
  }
}

function toText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
