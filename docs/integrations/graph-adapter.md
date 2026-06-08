# Graph Adapter Dry Run

This repository exposes a local graph adapter for integration-readiness work.
It converts existing `analytics_event`-shaped records into graph
`RawSourceEventRecord` JSON fixtures.

This is a local/staging dry-run adapter only. It does not push to graph, does
not deploy anything, and must not be used as `production_real_tenant` evidence.

## Commands

```bash
pnpm graph:export-fixture
pnpm graph:adapter:test
GRAPH_DRY_RUN_ENDPOINT=http://127.0.0.1:4017/integrations/store_digital_goods/source-events:dry-run pnpm graph:dry-run:http
GRAPH_DRY_RUN_ENDPOINT=http://127.0.0.1:4017/integrations/store_digital_goods/source-events:dry-run pnpm graph:runtime-dry-run:http
```

Generated fixtures:

- `test/fixtures/integrations/store_digital_goods/source-events-valid.json`
- `test/fixtures/integrations/store_digital_goods/source-events-negative.json`

`graph:dry-run:http` expects a local or staging Graph dry-run receiver to be
running. It posts the valid fixture, the negative fixture, and a missing-header
request to Graph's `/integrations/store_digital_goods/source-events:dry-run`
endpoint. The command must keep `production_write_enabled=false` for the valid
batch and verifies that Graph persists zero events in dry-run mode.

The valid fixture is generated from:

- `test/fixtures/integrations/store_digital_goods/analytics-events-valid.json`

## Runtime Dry Run

The backend also registers a `graph_dry_run` analytics destination. It is off by
default and only captures runtime dispatches when both env values are present:

```bash
GRAPH_DRY_RUN_ENABLED=true
GRAPH_DRY_RUN_ENDPOINT=https://graph-staging.example.com/integrations/store_digital_goods/source-events:dry-run
```

Optional runtime fields:

- `GRAPH_DRY_RUN_TENANT_ID` defaults to `tenant-store-local`
- `GRAPH_DRY_RUN_MANIFEST_ID` defaults to `store-digital-goods-source-mapping-v1`
- `GRAPH_DRY_RUN_DEFAULT_COUNTRY` defaults to `ZZ`
- `GRAPH_DRY_RUN_DEFAULT_LANGUAGE` defaults to `und`
- `GRAPH_DRY_RUN_DEFAULT_CHANNEL` defaults to `backend`
- `GRAPH_DRY_RUN_DEFAULT_PLATFORM` defaults to `web`

When enabled, backend hooks capture `purchase` and `order_access_claimed` events
for the `graph_dry_run` destination. The scheduled analytics dispatch job then
POSTs one event per dry-run request with `dry_run=true`,
`production_write_enabled=false`, `human_gate_approved=false`, and Graph-required
`Trace-Id` / `Idempotency-Key` headers. This remains staging evidence only; it
does not write to graph production storage.

`graph:runtime-dry-run:http` exercises that runtime destination directly against
a local or staging Graph dry-run receiver. It uses one `purchase`
`analytics_event` fixture and verifies `persisted_event_count=0`.

## Current Scope

Product id:

- `store_digital_goods`

Covered source event names:

- `view_item`
- `add_to_cart`
- `view_cart`
- `begin_checkout`
- `purchase`
- `order_access_claimed`

The exporter intentionally reuses the existing analytics pipeline shape:

- `analytics_event.id`
- `analytics_event.event_name`
- `analytics_event.event_key`
- `analytics_event.occurred_at`
- `analytics_event.cart_id`
- `analytics_event.order_id`
- `analytics_event.payment_attempt_id`
- `analytics_event.customer_email_hash`
- `analytics_event.payload_json`
- `analytics_event.metadata_json`

No core checkout, delivery, account, or analytics capture workflow is changed.

## PII Rules

The exporter does not emit raw `email`, `phone`, or `name` fields. If email
identity is available, only `identity.email_hash` is emitted.

Allowed `properties` are limited to non-sensitive or pseudonymous fields:

- `product_id`
- `variant_id`
- `cart_id`
- `order_id`
- `payment_attempt_id`
- `currency`
- `amount`
- `quantity`
- `page_path`
- `source_event_id`

Each exported event has a stable non-PII `idempotency_key`. If the source event
does not provide a trace id, the adapter generates a stable hashed
`trace-store-*` value.

## Negative Fixture Intent

`source-events-negative.json` intentionally includes:

- raw `identity.email`
- unknown `source_event_name`
- missing mapped required property (`variant_id` on `add_to_cart`)
- empty `trace_id`
- duplicate `idempotency_key`

Those records are for graph dry-run blocking tests only.

## Production Gate

Without a deployed graph staging or production receiver, real tenant consent
review, PII review, and human approval, store must not claim
`production_real_tenant` evidence.

Before sending real user data, graph needs:

- a staging or production ingest endpoint for store
- a human gate approving first-party tenant data flow
- a PII and consent-purpose review
- idempotency and trace coverage evidence from deployed traffic
- rollback and delete/replay handling for rejected batches

## Graph Mapping Manifest Fields To Add

Graph should add a `store_digital_goods` product metadata fixture and mapping
manifest. Suggested mapping fields:

| source_event_name | canonical_event_name | required source fields | purposes | pii_class |
| --- | --- | --- | --- | --- |
| `view_item` | `view_item` | `product_id`, `variant_id`, `currency`, `amount`, `quantity`, `page_path`, `source_event_id` | `analytics` | `product_id`, `variant_id`, `source_event_id`: `pseudonymous`; money/page fields: `none` |
| `add_to_cart` | `add_to_cart` | `product_id`, `variant_id`, `cart_id`, `currency`, `amount`, `quantity`, `source_event_id` | `analytics` | ids: `pseudonymous`; money fields: `none` |
| `view_cart` | `view_cart` | `cart_id`, `currency`, `amount`, `quantity`, `source_event_id` | `analytics` | ids: `pseudonymous`; money fields: `none` |
| `begin_checkout` | `begin_checkout` | `cart_id`, `currency`, `amount`, `quantity`, `source_event_id` | `analytics` | ids: `pseudonymous`; money fields: `none` |
| `purchase` | `purchase` | `order_id`, `payment_attempt_id`, `currency`, `amount`, `quantity`, `source_event_id` | `analytics`, `operations` | ids: `pseudonymous`; money fields: `none` |
| `order_access_claimed` | `order_access_claimed` | `order_id`, `source_event_id` | `analytics`, `operations` | ids: `pseudonymous` |

Suggested retention policy names:

- `store-analytics-180-days` for browsing/cart/checkout fields
- `store-operations-365-days` for purchase and order-access operational ids

Suggested masking policy for pseudonymous ids:

- `hash`
