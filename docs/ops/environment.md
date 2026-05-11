# Environment Variables

This project has two runtime apps: Medusa backend and Next.js storefront.

## Backend

File: `apps/backend/.env`

Required:

| Name | Purpose | Production note |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Use a strong DB password and private network address. |
| `REDIS_URL` | Redis connection string | Use private network address. |
| `JWT_SECRET` | Medusa auth JWT signing secret | Generate a long random value. |
| `COOKIE_SECRET` | Medusa cookie signing secret | Generate a long random value, different from `JWT_SECRET`. |
| `MANUAL_WEBHOOK_SECRET` | HMAC secret for `/hooks/payment/manual` signatures | Must be shared only with trusted webhook caller. Rotate periodically. |
| `MANUAL_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS` | Manual webhook timestamp tolerance window | Default `300`. Keep small to reduce replay window. |
| `ORDER_RECOVERY_MAX_FAILED_ATTEMPTS` | Max failed verify attempts before temporary block | Default `5`. |
| `ORDER_RECOVERY_BLOCK_SECONDS` | Temporary block duration for recovery verification | Default `600` seconds. |
| `CREDENTIAL_ENCRYPTION_KEY` | AES-256-GCM key for inventory credentials | Must decode to 32 bytes. Do not rotate without a migration plan. |
| `DELIVERY_ENCRYPTION_KEY` | AES-256-GCM key for delivery snapshots | Must decode to 32 bytes. Can fall back to credential key locally, but keep separate in production. |
| `STORE_CORS` | Allowed storefront origins | Set to the public storefront origin. |
| `ADMIN_CORS` | Allowed Admin origins | Set to the Admin/backend origin. |
| `AUTH_CORS` | Allowed auth origins | Include Admin and storefront origins. |
| `PORT` | Backend port | Local default is `9002`. |

Optional analytics and observability:

| Name | Purpose | Production note |
| --- | --- | --- |
| `ANALYTICS_ENABLED` | Master switch for analytics event capture and dispatch queue | Default `true`. Set `false` to fully pause analytics pipeline. |
| `ANALYTICS_DISPATCH_BATCH_SIZE` | Max dispatch records processed per destination per cron run | Default `100`. Increase gradually after monitoring DB and outbound latency. |
| `ANALYTICS_MAX_RETRY_ATTEMPTS` | Max delivery retries before dead-letter status | Default `12`. |
| `ANALYTICS_RETRY_BASE_SECONDS` | Base backoff seconds for retry schedule | Default `30`. |
| `ANALYTICS_RETRY_MAX_SECONDS` | Max backoff seconds for retry schedule | Default `3600`. |
| `GA4_ENABLED` | Enable GA4 backend dispatch destination | Requires both `GA4_MEASUREMENT_ID` and `GA4_API_SECRET`. |
| `GA4_MEASUREMENT_ID` | GA4 Measurement ID (`G-XXXX`) for Measurement Protocol | Treat as environment config, not client secret. |
| `GA4_API_SECRET` | GA4 Measurement Protocol API secret | Keep private in backend env only. |
| `PLATFORM_ENABLED_PLUGINS` | Backend plugin allow-list (comma-separated IDs). | Merged with `NEXT_PUBLIC_PLATFORM_ENABLED_PLUGINS`; duplicates removed. |
| `PLATFORM_DISABLED_PLUGINS` | Backend plugin deny-list (comma-separated IDs). | Merged with `NEXT_PUBLIC_PLATFORM_DISABLED_PLUGINS`; duplicates removed. |
| `PLATFORM_ENABLED_CONTRACTS` | Capability contract allow-list (`capability:name1,name2;...`). | Applied before plugin registration for deterministic startup behavior. |
| `PLATFORM_DISABLED_CONTRACTS` | Capability contract deny-list (`capability:name1,name2;...`). | Useful for fine-grained strategy/hook shutdown without disabling whole plugin. |

Plugin dependency enablement is evaluated at runtime: if a plugin's required dependency is disabled, the dependent plugin is treated as disabled automatically.

Generate a 32-byte base64 key:

```bash
openssl rand -base64 32
```

## Storefront

File: `apps/storefront/.env.local`

Required:

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | Public URL of the backend Store API. |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Medusa publishable API key. |
| `NEXT_PUBLIC_MEDUSA_REGION_ID` | Optional fixed region id. |

Optional analytics and plugin runtime:

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Enables GA4 storefront script injection when non-empty. |
| `NEXT_PUBLIC_HOTJAR_SITE_ID` | Enables Hotjar storefront script injection when non-empty. |
| `NEXT_PUBLIC_HOTJAR_SNIPPET_VERSION` | Hotjar snippet version, default `6`. |
| `NEXT_PUBLIC_PLATFORM_ENABLED_PLUGINS` | Storefront plugin allow-list (comma-separated IDs). |
| `NEXT_PUBLIC_PLATFORM_DISABLED_PLUGINS` | Comma-separated plugin IDs to disable on storefront (for example `analytics-hotjar,analytics-ga4`). |

Do not place payment provider secrets or encryption keys in storefront env.

## Deployment Layout

When using the production deployment scripts, runtime env files are managed outside the release directory:

- Backend: `/opt/store/shared/backend.env`
- Storefront: `/opt/store/shared/storefront.env`

Each new release symlinks these files into:

- `apps/backend/.env`
- `apps/storefront/.env.local`
