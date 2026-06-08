import {
  exportAnalyticsEventToGraphRawSourceEvent,
  exportAnalyticsEventsToGraphRawSourceEvents,
  hasRawPiiKey,
  STORE_GRAPH_PRODUCT_ID,
  type StoreAnalyticsEventForGraph,
} from "../graph-exporter"

const EMAIL_HASH =
  "b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514"

describe("store graph analytics exporter", () => {
  it("maps supported analytics events to graph raw source events", () => {
    const exported = exportAnalyticsEventToGraphRawSourceEvent(baseEvent(), {
      tenantId: "tenant-fixture",
      defaultCountry: "US",
      defaultLanguage: "en-US",
    })

    expect(exported).toMatchObject({
      record_id: "store-analytics-aevt_001",
      tenant_id: "tenant-fixture",
      product_id: STORE_GRAPH_PRODUCT_ID,
      source_event_name: "add_to_cart",
      source: "store_analytics_event",
      trace_id: "trace-local-001",
      session_id: "sess-local-001",
      channel: "storefront",
      platform: "web",
      country: "US",
      language: "en-US",
      identity: {
        email_hash: EMAIL_HASH,
        anonymous_id: "anon-local-001",
      },
      properties: {
        product_id: "prod_001",
        variant_id: "variant_001",
        cart_id: "cart_001",
        currency: "USD",
        amount: 15,
        quantity: 1,
        page_path: "/products/prod-001",
        source_event_id: "aevt_001",
      },
      processing_purpose: ["analytics"],
      data_source_type: "first_party",
      data_classification: "pseudonymous",
    })
  })

  it("filters unsupported events and never exports raw email fields", () => {
    const events = exportAnalyticsEventsToGraphRawSourceEvents([
      {
        ...baseEvent(),
        payload_json: {
          params: {
            ...baseEvent().payload_json?.params,
            customer_email: "buyer@example.com",
          },
        },
      },
      {
        ...baseEvent(),
        id: "aevt_unsupported",
        event_name: "password_reset_requested",
      },
    ])

    expect(events).toHaveLength(1)
    expect(JSON.stringify(events[0])).not.toContain("buyer@example.com")
    expect(hasRawPiiKey(events[0])).toBe(false)
  })

  it("generates stable non-PII trace and idempotency fallback values", () => {
    const event = {
      ...baseEvent(),
      event_key: null,
      metadata_json: {},
    }

    const first = exportAnalyticsEventToGraphRawSourceEvent(event)
    const second = exportAnalyticsEventToGraphRawSourceEvent(event)

    expect(first?.trace_id).toMatch(/^trace-store-[a-f0-9]{20}$/)
    expect(first?.idempotency_key).toMatch(/^store-analytics-[a-f0-9]{20}$/)
    expect(first?.trace_id).toBe(second?.trace_id)
    expect(first?.idempotency_key).toBe(second?.idempotency_key)
    expect(first?.trace_id).not.toContain(event.id)
  })
})

function baseEvent(): StoreAnalyticsEventForGraph & {
  payload_json: { params: Record<string, unknown> }
} {
  return {
    id: "aevt_001",
    event_name: "add_to_cart",
    source: "storefront",
    event_key: "storefront:add_to_cart:variant_001:cart_001",
    occurred_at: "2026-06-08T01:00:00Z",
    created_at: "2026-06-08T01:00:01Z",
    cart_id: "cart_001",
    order_id: null,
    payment_attempt_id: null,
    customer_email_hash: EMAIL_HASH,
    payload_json: {
      params: {
        product_id: "prod_001",
        variant_id: "variant_001",
        currency: "USD",
        value: 15,
        quantity: 1,
        items: [
          {
            item_id: "variant_001",
            product_id: "prod_001",
            quantity: 1,
            item_name: "Do not export names",
          },
        ],
      },
    },
    metadata_json: {
      trace_id: "trace-local-001",
      session_id: "sess-local-001",
      anonymous_id: "anon-local-001",
      page_path: "/products/prod-001",
      country: "US",
      language: "en-US",
      platform: "web",
    },
  }
}
