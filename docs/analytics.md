# Analytics Module

This repository includes a decoupled analytics pipeline with plugin-style destinations and storefront script slots.

## Modules and Plugins

- `analytics-core` (backend module)
  - Canonical event table: `analytics_event`
  - Per-destination dispatch table: `analytics_dispatch`
  - Idempotent event capture + retry/backoff delivery queue
- `analytics-ga4` (backend + storefront plugin)
  - Backend dispatch destination to GA4 Measurement Protocol
  - Storefront GA4 script injection (`layout.body.end` slot)
- `analytics-hotjar` (storefront plugin)
  - Storefront Hotjar script injection (`layout.body.end` slot)
  - Mirrors `store:analytics` event bus to `hj('event', ...)`

## Runtime Toggle Model

Disable plugins globally (backend plugin runtime):

```env
PLATFORM_DISABLED_PLUGINS=analytics-ga4,analytics-hotjar
```

Disable storefront plugin slots:

```env
NEXT_PUBLIC_PLATFORM_DISABLED_PLUGINS=analytics-hotjar
```

Analytics pipeline master switch:

```env
ANALYTICS_ENABLED=false
```

## Event Capture Path

1. Storefront emits events through `emitStoreAnalyticsEvent(...)` (`store:analytics` custom event).
2. Checkout API submits analytics context (`ga_client_id`, `ga_session_id`, `page_location`, `page_path`, `referrer`).
3. Backend hooks capture canonical events via `analytics-core`.
4. `process-analytics-dispatches` job dispatches events per destination with retry/backoff.
5. Admin analytics page and APIs expose event + dispatch state.

## Built-in Events

Current instrumentation includes:

- `view_item`
- `add_to_cart`
- `view_cart`
- `begin_checkout`
- `purchase`
- `order_access_claimed`
- `order_recovery_code_sent`
- `order_recovery_verified`

## Admin APIs and UI

- `GET /admin/analytics/events`
- `GET /admin/analytics/dispatches`
- `POST /admin/analytics/dispatches` (`dispatch_id`) for replay
- Admin page: `/app/analytics`

## GA4 Configuration

Backend (`apps/backend/.env`):

```env
GA4_ENABLED=true
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
GA4_API_SECRET=xxxxxxxxxxxxxxxx
```

Storefront (`apps/storefront/.env.local`):

```env
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
```

Notes:

- Backend and storefront can be enabled independently, but production usually enables both.
- `GA4_API_SECRET` must never be exposed to storefront.

## Hotjar Configuration

Storefront (`apps/storefront/.env.local`):

```env
NEXT_PUBLIC_HOTJAR_SITE_ID=1234567
NEXT_PUBLIC_HOTJAR_SNIPPET_VERSION=6
```

## Local Verification

1. Run build checks:

```bash
pnpm --dir apps/backend build
pnpm --dir apps/storefront lint
pnpm --dir apps/storefront build
```

2. Execute checkout flow and payment claim.
3. Open Admin `Analytics` page and confirm event + dispatch rows update as expected.
