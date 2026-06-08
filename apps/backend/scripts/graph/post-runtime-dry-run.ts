import fs from "fs"
import path from "path"
import { getAnalyticsDestination } from "../../src/platform/analytics"
import { ensurePlatformIntegrationsRegistered } from "../../src/platform-adapters/integrations"
import { GRAPH_DRY_RUN_DESTINATION_CODE } from "../../src/modules/analytics-core/graph-dry-run-destination"
import {
  STORE_GRAPH_PRODUCT_ID,
  type StoreAnalyticsEventForGraph,
} from "../../src/modules/analytics-core/graph-exporter"
import { STORE_GRAPH_MANIFEST_ID } from "../../src/modules/analytics-core/graph-dry-run-config"

type GraphDryRunResponse = {
  accepted_for_processing: boolean
  persisted_event_count: number
  received_event_count: number
  preflight?: {
    accepted_event_count?: number
  }
}

const repoRoot = path.resolve(process.cwd(), "../..")
const fixtureDir = path.join(
  repoRoot,
  "test/fixtures/integrations/store_digital_goods"
)
const analyticsEventsPath = path.join(fixtureDir, "analytics-events-valid.json")
const defaultEndpoint =
  "http://127.0.0.1:4017/integrations/store_digital_goods/source-events:dry-run"

async function main() {
  const endpoint = process.env.GRAPH_DRY_RUN_ENDPOINT || defaultEndpoint
  process.env.GRAPH_DRY_RUN_ENABLED = "true"
  process.env.GRAPH_DRY_RUN_ENDPOINT = endpoint
  process.env.GRAPH_DRY_RUN_TENANT_ID ||= "tenant-store-local"
  process.env.GRAPH_DRY_RUN_MANIFEST_ID ||= STORE_GRAPH_MANIFEST_ID
  process.env.GRAPH_DRY_RUN_DEFAULT_COUNTRY ||= "US"
  process.env.GRAPH_DRY_RUN_DEFAULT_LANGUAGE ||= "en-US"
  process.env.GRAPH_DRY_RUN_DEFAULT_CHANNEL ||= "backend"
  process.env.GRAPH_DRY_RUN_DEFAULT_PLATFORM ||= "web"

  ensurePlatformIntegrationsRegistered()

  const destination = getAnalyticsDestination(GRAPH_DRY_RUN_DESTINATION_CODE)

  if (!destination) {
    throw new Error("Graph dry-run destination was not registered")
  }

  const event = purchaseEvent()
  const result = await destination.send({
    event,
    dispatch: {
      id: "adisp_runtime_http_dry_run_001",
    },
  })
  const body = parseResponseBody(result.responseBody)

  if (result.status !== 202) {
    throw new Error(`Graph runtime dry-run status ${result.status}, expected 202`)
  }

  if (!body.accepted_for_processing) {
    throw new Error("Graph runtime dry-run was not accepted for processing")
  }

  if (body.persisted_event_count !== 0) {
    throw new Error(
      `Graph runtime dry-run persisted ${body.persisted_event_count} events`
    )
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "runtime_destination_http_dry_run",
        endpoint,
        destination_code: GRAPH_DRY_RUN_DESTINATION_CODE,
        product_id: STORE_GRAPH_PRODUCT_ID,
        manifest_id: process.env.GRAPH_DRY_RUN_MANIFEST_ID,
        source_event_name: event.event_name,
        http_status: result.status,
        received_event_count: body.received_event_count,
        accepted_event_count: body.preflight?.accepted_event_count,
        dry_run_persisted_event_count: body.persisted_event_count,
        production_write_enabled: false,
      },
      null,
      2
    )
  )
}

function purchaseEvent() {
  const events = readJson<StoreAnalyticsEventForGraph[]>(analyticsEventsPath)
  const event = events.find((item) => item.event_name === "purchase")

  if (!event) {
    throw new Error("analytics-events-valid.json does not include purchase")
  }

  return event
}

function parseResponseBody(value: string | undefined) {
  if (!value) {
    throw new Error("Graph runtime dry-run returned an empty response body")
  }

  return JSON.parse(value) as GraphDryRunResponse
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
