import fs from "fs"
import path from "path"
import {
  exportAnalyticsEventsToGraphRawSourceEvents,
  hasRawPiiKey,
  STORE_GRAPH_PRODUCT_ID,
  type GraphRawSourceEventRecord,
  type StoreAnalyticsEventForGraph,
} from "../../src/modules/analytics-core/graph-exporter"

const repoRoot = path.resolve(process.cwd(), "../..")
const fixtureDir = path.join(
  repoRoot,
  "test/fixtures/integrations/store_digital_goods"
)
const analyticsInputPath = path.join(fixtureDir, "analytics-events-valid.json")
const validOutputPath = path.join(fixtureDir, "source-events-valid.json")
const negativeOutputPath = path.join(fixtureDir, "source-events-negative.json")

function main() {
  const analyticsEvents = readJson<StoreAnalyticsEventForGraph[]>(
    analyticsInputPath
  )
  const valid = exportAnalyticsEventsToGraphRawSourceEvents(analyticsEvents, {
    tenantId: "tenant-store-local",
    defaultCountry: "US",
    defaultLanguage: "en-US",
    defaultPlatform: "web",
  })
  const negative = buildNegativeFixture()

  assertValidFixture(valid)
  assertNegativeFixture(negative)
  writeJson(validOutputPath, valid)
  writeJson(negativeOutputPath, negative)

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "local_staging_dry_run",
        product_id: STORE_GRAPH_PRODUCT_ID,
        analytics_input: relative(analyticsInputPath),
        valid_output: relative(validOutputPath),
        negative_output: relative(negativeOutputPath),
        valid_count: valid.length,
        negative_count: negative.length,
        production_write_enabled: false,
      },
      null,
      2
    )
  )
}

function buildNegativeFixture(): GraphRawSourceEventRecord[] {
  return [
    {
      record_id: "store-negative-unknown-event-001",
      tenant_id: "tenant-store-local",
      product_id: STORE_GRAPH_PRODUCT_ID,
      source_event_name: "password_reset_requested",
      occurred_at: "2026-06-08T02:00:00.000Z",
      received_at: "2026-06-08T02:00:01.000Z",
      source: "store_analytics_event",
      trace_id: "trace-store-negative-unknown-event-001",
      idempotency_key: "store-negative-idem-001",
      session_id: "sess_store_negative_001",
      channel: "storefront",
      platform: "web",
      country: "US",
      language: "en-US",
      identity: {
        email: "raw-buyer@example.com",
      },
      properties: {
        source_event_id: "aevt_store_negative_unknown_001",
      },
      processing_purpose: ["analytics"],
      data_source_type: "first_party",
      data_classification: "personal",
    },
    {
      record_id: "store-negative-missing-required-field-001",
      tenant_id: "tenant-store-local",
      product_id: STORE_GRAPH_PRODUCT_ID,
      source_event_name: "add_to_cart",
      occurred_at: "2026-06-08T02:01:00.000Z",
      received_at: "2026-06-08T02:01:01.000Z",
      source: "store_analytics_event",
      trace_id: "",
      idempotency_key: "store-negative-idem-002",
      session_id: "sess_store_negative_001",
      channel: "storefront",
      platform: "web",
      country: "US",
      language: "en-US",
      identity: {
        anonymous_id: "anon_store_negative_001",
      },
      properties: {
        cart_id: "cart_store_negative_001",
        currency: "USD",
        amount: 15,
        quantity: 1,
        source_event_id: "aevt_store_negative_missing_required_001",
      },
      processing_purpose: ["analytics"],
      data_source_type: "first_party",
      data_classification: "pseudonymous",
    },
    {
      record_id: "store-negative-duplicate-idempotency-001",
      tenant_id: "tenant-store-local",
      product_id: STORE_GRAPH_PRODUCT_ID,
      source_event_name: "purchase",
      occurred_at: "2026-06-08T02:02:00.000Z",
      received_at: "2026-06-08T02:02:01.000Z",
      source: "store_analytics_event",
      trace_id: "trace-store-negative-duplicate-001",
      idempotency_key: "store-negative-duplicate-idem",
      session_id: "sess_store_negative_001",
      channel: "backend",
      platform: "web",
      country: "US",
      language: "en-US",
      identity: {
        email_hash:
          "b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514",
      },
      properties: {
        order_id: "order_store_negative_001",
        payment_attempt_id: "payatt_store_negative_001",
        currency: "USD",
        amount: 15,
        quantity: 1,
        source_event_id: "aevt_store_negative_duplicate_001",
      },
      processing_purpose: ["analytics", "operations"],
      data_source_type: "first_party",
      data_classification: "pseudonymous",
    },
    {
      record_id: "store-negative-duplicate-idempotency-002",
      tenant_id: "tenant-store-local",
      product_id: STORE_GRAPH_PRODUCT_ID,
      source_event_name: "purchase",
      occurred_at: "2026-06-08T02:03:00.000Z",
      received_at: "2026-06-08T02:03:01.000Z",
      source: "store_analytics_event",
      trace_id: "trace-store-negative-duplicate-002",
      idempotency_key: "store-negative-duplicate-idem",
      session_id: "sess_store_negative_001",
      channel: "backend",
      platform: "web",
      country: "US",
      language: "en-US",
      identity: {
        email_hash:
          "b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514",
      },
      properties: {
        order_id: "order_store_negative_002",
        payment_attempt_id: "payatt_store_negative_002",
        currency: "USD",
        amount: 15,
        quantity: 1,
        source_event_id: "aevt_store_negative_duplicate_002",
      },
      processing_purpose: ["analytics", "operations"],
      data_source_type: "first_party",
      data_classification: "pseudonymous",
    },
  ]
}

function assertValidFixture(events: GraphRawSourceEventRecord[]) {
  if (events.length !== 6) {
    throw new Error(`Expected 6 valid source events, got ${events.length}`)
  }

  if (events.some((event) => hasRawPiiKey(event))) {
    throw new Error("Valid graph fixture contains a raw PII field")
  }

  for (const event of events) {
    for (const key of [
      "record_id",
      "tenant_id",
      "product_id",
      "source_event_name",
      "occurred_at",
      "received_at",
      "source",
      "trace_id",
      "idempotency_key",
      "session_id",
      "properties",
    ] as const) {
      if (!event[key]) {
        throw new Error(`Valid graph fixture event ${event.record_id} lacks ${key}`)
      }
    }
  }
}

function assertNegativeFixture(events: GraphRawSourceEventRecord[]) {
  const duplicateCount = new Map<string, number>()

  for (const event of events) {
    duplicateCount.set(
      event.idempotency_key,
      (duplicateCount.get(event.idempotency_key) || 0) + 1
    )
  }

  const hasDuplicateIdempotency = Array.from(duplicateCount.values()).some(
    (count) => count > 1
  )

  if (!events.some((event) => event.identity.email)) {
    throw new Error("Negative graph fixture must include raw identity.email")
  }

  if (!events.some((event) => event.source_event_name === "password_reset_requested")) {
    throw new Error("Negative graph fixture must include an unknown event")
  }

  if (
    !events.some(
      (event) =>
        event.source_event_name === "add_to_cart" &&
        typeof event.properties.variant_id === "undefined"
    )
  ) {
    throw new Error("Negative graph fixture must omit a mapped required field")
  }

  if (!events.some((event) => !event.trace_id)) {
    throw new Error("Negative graph fixture must include a missing trace id")
  }

  if (!hasDuplicateIdempotency) {
    throw new Error("Negative graph fixture must include duplicate idempotency")
  }
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function relative(filePath: string) {
  return path.relative(repoRoot, filePath)
}

main()
