import fs from "fs"
import path from "path"
import {
  STORE_GRAPH_PRODUCT_ID,
  type GraphRawSourceEventRecord,
} from "../../src/modules/analytics-core/graph-exporter"

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

type GraphDryRunResponse = {
  request_id: string
  tenant_id: string
  product_id: string
  manifest_id: string
  dry_run: boolean
  production_write_enabled: boolean
  human_gate_approved: boolean
  accepted_for_processing: boolean
  persisted_event_count: number
  received_event_count: number
  preflight: {
    accepted_event_count: number
    replay_acceptance_rate: number
    pii_issue_count: number
    schema_drift_count: number
    idempotency_issue_count: number
  }
  receiver_gate_reason_codes: string[]
  blocked_reason_codes: string[]
}

type HttpResult = {
  status: number
  body: GraphDryRunResponse
}

const STORE_GRAPH_MANIFEST_ID = "store-digital-goods-source-mapping-v1"
const repoRoot = path.resolve(process.cwd(), "../..")
const fixtureDir = path.join(
  repoRoot,
  "test/fixtures/integrations/store_digital_goods"
)
const validEventsPath = path.join(fixtureDir, "source-events-valid.json")
const negativeEventsPath = path.join(fixtureDir, "source-events-negative.json")
const defaultEndpoint =
  "http://127.0.0.1:4017/integrations/store_digital_goods/source-events:dry-run"

async function main() {
  const endpoint = process.env.GRAPH_DRY_RUN_ENDPOINT || defaultEndpoint
  const validEvents = readJson<GraphRawSourceEventRecord[]>(validEventsPath)
  const negativeEvents = readJson<GraphRawSourceEventRecord[]>(negativeEventsPath)
  const valid = validRequest(validEvents)
  const negative = negativeRequest(negativeEvents)
  const validResult = await postDryRun(endpoint, valid, {
    "Trace-Id": valid.trace_id,
    "Idempotency-Key": valid.idempotency_key,
  })
  const negativeResult = await postDryRun(endpoint, negative, {
    "Trace-Id": negative.trace_id,
    "Idempotency-Key": negative.idempotency_key,
  })
  const missingHeaderResult = await postDryRun(endpoint, valid, {})

  assertResult("valid", validResult, {
    expectedStatus: 202,
    acceptedForProcessing: true,
    expectedReceivedEvents: 6,
  })
  assertResult("negative", negativeResult, {
    expectedStatus: 422,
    acceptedForProcessing: false,
    expectedReceivedEvents: 4,
  })
  assertResult("missing_header", missingHeaderResult, {
    expectedStatus: 422,
    acceptedForProcessing: false,
    expectedReceivedEvents: 6,
  })

  if (
    !missingHeaderResult.body.blocked_reason_codes.includes(
      "http:missing_trace_id_header"
    ) ||
    !missingHeaderResult.body.blocked_reason_codes.includes(
      "http:missing_idempotency_key_header"
    )
  ) {
    throw new Error("Graph dry-run endpoint did not enforce trace/idempotency headers")
  }

  if (
    negativeResult.body.preflight.pii_issue_count < 1 ||
    negativeResult.body.preflight.schema_drift_count < 2 ||
    negativeResult.body.preflight.idempotency_issue_count < 2
  ) {
    throw new Error(
      "Graph dry-run endpoint did not preserve expected negative fixture blockers"
    )
  }

  const persistedEventCount =
    validResult.body.persisted_event_count +
    negativeResult.body.persisted_event_count +
    missingHeaderResult.body.persisted_event_count

  if (persistedEventCount !== 0) {
    throw new Error(`Graph dry-run endpoint persisted ${persistedEventCount} events`)
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "local_staging_http_dry_run",
        endpoint,
        product_id: STORE_GRAPH_PRODUCT_ID,
        manifest_id: STORE_GRAPH_MANIFEST_ID,
        valid_http_status: validResult.status,
        negative_http_status: negativeResult.status,
        missing_header_http_status: missingHeaderResult.status,
        valid_received_event_count: validResult.body.received_event_count,
        valid_accepted_event_count:
          validResult.body.preflight.accepted_event_count,
        negative_blocked_reason_codes: negativeResult.body.blocked_reason_codes,
        missing_header_reason_codes:
          missingHeaderResult.body.blocked_reason_codes,
        dry_run_persisted_event_count: persistedEventCount,
        production_write_enabled: false,
      },
      null,
      2
    )
  )
}

function validRequest(events: GraphRawSourceEventRecord[]): GraphDryRunRequest {
  return {
    request_id: "store-side-http-dry-run-valid-001",
    tenant_id: "tenant-store-local",
    product_id: STORE_GRAPH_PRODUCT_ID,
    manifest_id: STORE_GRAPH_MANIFEST_ID,
    dry_run: true,
    production_write_enabled: false,
    human_gate_approved: false,
    trace_id: "trace-store-side-http-dry-run-valid-001",
    idempotency_key: "store-side-http-dry-run-valid-001",
    events,
  }
}

function negativeRequest(events: GraphRawSourceEventRecord[]): GraphDryRunRequest {
  return {
    request_id: "store-side-http-dry-run-negative-001",
    tenant_id: "tenant-store-local",
    product_id: STORE_GRAPH_PRODUCT_ID,
    manifest_id: STORE_GRAPH_MANIFEST_ID,
    dry_run: false,
    production_write_enabled: true,
    human_gate_approved: false,
    trace_id: "trace-store-side-http-dry-run-negative-001",
    idempotency_key: "store-side-http-dry-run-negative-001",
    events: events.map((event, index) =>
      index === 0 ? { ...event, tenant_id: "tenant-store-other" } : event
    ),
  }
}

async function postDryRun(
  endpoint: string,
  body: GraphDryRunRequest,
  headers: Record<string, string>
): Promise<HttpResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  })
  const responseBody = (await response.json()) as GraphDryRunResponse

  return {
    status: response.status,
    body: responseBody,
  }
}

function assertResult(
  label: string,
  result: HttpResult,
  expected: {
    expectedStatus: number
    acceptedForProcessing: boolean
    expectedReceivedEvents: number
  }
) {
  if (result.status !== expected.expectedStatus) {
    throw new Error(
      `${label} dry-run status ${result.status}, expected ${expected.expectedStatus}`
    )
  }

  if (result.body.accepted_for_processing !== expected.acceptedForProcessing) {
    throw new Error(
      `${label} accepted_for_processing ${result.body.accepted_for_processing}, expected ${expected.acceptedForProcessing}`
    )
  }

  if (result.body.received_event_count !== expected.expectedReceivedEvents) {
    throw new Error(
      `${label} received_event_count ${result.body.received_event_count}, expected ${expected.expectedReceivedEvents}`
    )
  }
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
