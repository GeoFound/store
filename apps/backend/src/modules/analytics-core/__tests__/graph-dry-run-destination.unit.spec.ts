import { getAnalyticsDestination } from "../../../platform/analytics"
import { resetPlatformRuntimeForTests } from "../../../platform/runtime"
import { ensurePlatformIntegrationsRegistered } from "../../../platform-adapters/integrations"
import { GRAPH_DRY_RUN_DESTINATION_CODE } from "../graph-dry-run-destination"

const EMAIL_HASH =
  "b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514"

describe("graph dry-run analytics destination", () => {
  const originalEnv = process.env
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
    process.env = {
      ...originalEnv,
      GA4_ENABLED: "false",
      GRAPH_DRY_RUN_ENABLED: "true",
      GRAPH_DRY_RUN_ENDPOINT:
        "http://127.0.0.1:4017/integrations/store_digital_goods/source-events:dry-run",
      GRAPH_DRY_RUN_TENANT_ID: "tenant-store-staging",
      GRAPH_DRY_RUN_MANIFEST_ID: "store-digital-goods-source-mapping-v1",
      GRAPH_DRY_RUN_DEFAULT_COUNTRY: "US",
      GRAPH_DRY_RUN_DEFAULT_LANGUAGE: "en-US",
    }
    resetPlatformRuntimeForTests()
    global.fetch = jest.fn() as unknown as typeof fetch
  })

  afterAll(() => {
    process.env = originalEnv
    global.fetch = originalFetch
  })

  it("posts exported analytics events to Graph in dry-run mode", async () => {
    ;(global.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 202,
      text: async () =>
        JSON.stringify({
          accepted_for_processing: true,
          persisted_event_count: 0,
        }),
    })

    const destination = getGraphDestination()
    const result = await destination.send({
      event: basePurchaseEvent(),
      dispatch: {
        id: "adisp_runtime_purchase_001",
      },
    })

    expect(result.status).toBe(202)
    expect(global.fetch).toHaveBeenCalledTimes(1)

    const [url, request] = (global.fetch as unknown as jest.Mock).mock.calls[0]
    expect(url).toBe(
      "http://127.0.0.1:4017/integrations/store_digital_goods/source-events:dry-run"
    )
    expect(request).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Trace-Id": "trace-runtime-purchase-001",
      },
    })

    const body = JSON.parse(String(request.body))
    expect(body).toMatchObject({
      request_id: "store-runtime-graph-dry-run:adisp_runtime_purchase_001",
      tenant_id: "tenant-store-staging",
      product_id: "store_digital_goods",
      manifest_id: "store-digital-goods-source-mapping-v1",
      dry_run: true,
      production_write_enabled: false,
      human_gate_approved: false,
      trace_id: "trace-runtime-purchase-001",
    })
    expect(request.headers["Idempotency-Key"]).toBe(body.idempotency_key)
    expect(body.events).toHaveLength(1)
    expect(body.events[0]).toMatchObject({
      tenant_id: "tenant-store-staging",
      product_id: "store_digital_goods",
      source_event_name: "purchase",
      source: "store_analytics_event",
      trace_id: "trace-runtime-purchase-001",
      channel: "backend",
      platform: "web",
      country: "US",
      language: "en-US",
      identity: {
        email_hash: EMAIL_HASH,
        anonymous_id: "anon-runtime-purchase-001",
      },
      properties: {
        order_id: "order_runtime_001",
        payment_attempt_id: "payatt_runtime_001",
        currency: "USD",
        amount: 15,
        quantity: 1,
        source_event_id: "aevt_runtime_purchase_001",
      },
      processing_purpose: ["analytics", "operations"],
      data_source_type: "first_party",
      data_classification: "pseudonymous",
    })
    expect(JSON.stringify(body)).not.toContain("buyer@example.com")
  })

  it("does not dispatch when the destination is not configured", async () => {
    process.env.GRAPH_DRY_RUN_ENABLED = "false"

    const destination = getGraphDestination()

    await expect(
      destination.send({
        event: basePurchaseEvent(),
        dispatch: {
          id: "adisp_runtime_purchase_001",
        },
      })
    ).rejects.toThrow("Graph dry-run destination is not configured")
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("surfaces Graph receiver rejection details", async () => {
    ;(global.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "blocked by graph dry-run preflight",
    })

    const destination = getGraphDestination()

    await expect(
      destination.send({
        event: basePurchaseEvent(),
        dispatch: {
          id: "adisp_runtime_purchase_001",
        },
      })
    ).rejects.toThrow(
      "Graph dry-run dispatch failed with status 422: blocked by graph dry-run preflight"
    )
  })
})

function getGraphDestination() {
  ensurePlatformIntegrationsRegistered()

  const destination = getAnalyticsDestination(GRAPH_DRY_RUN_DESTINATION_CODE)

  if (!destination) {
    throw new Error("Graph dry-run destination was not registered")
  }

  return destination
}

function basePurchaseEvent() {
  return {
    id: "aevt_runtime_purchase_001",
    event_name: "purchase",
    source: "backend_hook",
    event_key: "graph:purchase:payatt_runtime_001:order_runtime_001",
    occurred_at: "2026-06-08T01:00:00Z",
    created_at: "2026-06-08T01:00:01Z",
    cart_id: "cart_runtime_001",
    order_id: "order_runtime_001",
    payment_attempt_id: "payatt_runtime_001",
    customer_email_hash: EMAIL_HASH,
    payload_json: {
      name: "purchase",
      client_id: "anon-runtime-purchase-001",
      params: {
        transaction_id: "order_runtime_001",
        payment_attempt_id: "payatt_runtime_001",
        currency: "USD",
        value: 15,
        items: [
          {
            item_id: "variant_runtime_001",
            quantity: 1,
            item_name: "Do not export names",
          },
        ],
      },
    },
    metadata_json: {
      trace_id: "trace-runtime-purchase-001",
      session_id: "sess-runtime-purchase-001",
      country: "US",
      language: "en-US",
      platform: "web",
    },
  }
}
