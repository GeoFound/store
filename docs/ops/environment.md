# Environment Variables

This project has two runtime apps: Medusa backend and Next.js storefront.

## Backend

File: `apps/backend/.env`

Required:

| Name | Purpose | Production note |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Use a strong DB password and private network address. |
| `REDIS_URL` | Redis connection string | Use private network address; when Redis auth is enabled include password (for example `redis://:password@127.0.0.1:6380`). |
| `JWT_SECRET` | Medusa auth JWT signing secret | Generate a long random value. |
| `COOKIE_SECRET` | Medusa cookie signing secret | Generate a long random value, different from `JWT_SECRET`. |
| `MANUAL_WEBHOOK_SECRET` | HMAC secret for `/hooks/payment/manual` signatures | Must be shared only with trusted webhook caller. Rotate periodically. |
| `MANUAL_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS` | Manual webhook timestamp tolerance window | Default `300`. Keep small to reduce replay window. |
| `ORDER_RECOVERY_MAX_FAILED_ATTEMPTS` | Max failed verify attempts before temporary block | Default `5`. |
| `ORDER_RECOVERY_BLOCK_SECONDS` | Temporary block duration for recovery verification | Default `600` seconds. |
| `CREDENTIAL_ENCRYPTION_KEY` | Primary AES-256-GCM key for inventory credentials | Must decode to 32 bytes. |
| `CREDENTIAL_ENCRYPTION_KEY_PREVIOUS` | Optional previous inventory keys for key rotation (comma-separated) | Each key must decode to 32 bytes. Keep old keys only during migration window. |
| `DELIVERY_ENCRYPTION_KEY` | Primary AES-256-GCM key for delivery snapshots | Must decode to 32 bytes. Can fall back to credential key locally, but keep separate in production. |
| `DELIVERY_ENCRYPTION_KEY_PREVIOUS` | Optional previous delivery keys for key rotation (comma-separated) | Each key must decode to 32 bytes. Keep old keys only during migration window. |
| `STORE_CORS` | Allowed storefront origins | Set to the public storefront origin. |
| `ADMIN_CORS` | Allowed Admin origins | Set to the Admin/backend origin. |
| `AUTH_CORS` | Allowed auth origins | Include Admin and storefront origins. |
| `PORT` | Backend port | Local default is `9002`. |

Optional customer account authentication:

| Name | Purpose | Production note |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID for customer account login | Configure together with `GOOGLE_CLIENT_SECRET` and `GOOGLE_CALLBACK_URL`; leave all empty to disable Google login. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret for customer account login | Backend-only secret. |
| `GOOGLE_CALLBACK_URL` | Storefront callback URL registered in Google Cloud | Use the storefront BFF callback, for example `https://example.com/api/account/google/callback`. |

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
| `RESEND_ENABLED` | Enable Resend transactional email delivery for notification hooks | Default `false`. Set to `true` only when all Resend fields below are configured. |
| `RESEND_API_KEY` | Resend API key | Required when `RESEND_ENABLED=true`; keep private in backend env only. |
| `RESEND_FROM_EMAIL` | Sender identity used by Resend (`no-reply@example.com` or `Store <no-reply@example.com>`) | Required when `RESEND_ENABLED=true`; domain must be verified in Resend. |
| `RESEND_REPLY_TO_EMAIL` | Optional reply-to address for support workflows | Recommended for recovery/support emails. |
| `RESEND_API_BASE_URL` | Resend API base URL | Default `https://api.resend.com`; override only for controlled proxies. |
| `AI_ENABLED` | Enable provider-neutral AI task execution surfaces | Default `false`. Keep disabled until provider credentials and review workflows are ready. |
| `AI_DEFAULT_PROVIDER` | Default AI provider code selected from `AI_PROVIDER_CONFIGS_JSON` | Optional. Use the provider code, not a vendor-specific env key. |
| `AI_PROVIDER_CONFIGS_JSON` | JSON array of AI provider configs with `code`, `protocol`, `base_url`, `api_key_env`, and `default_model` fields | Keep backend-only. Do not put plaintext keys here; reference deployment-owned key env names such as `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`. |
| `SUPPLIER_ENCRYPTION_KEY` | Primary AES-256-GCM key for supplier fulfillment snapshots | Must decode to 32 bytes. Defaults to `DELIVERY_ENCRYPTION_KEY` when omitted. Keep separate in production when supplier payloads include redeemable secrets. |
| `SUPPLIER_ENCRYPTION_KEY_PREVIOUS` | Optional previous supplier keys for key rotation (comma-separated) | Each key must decode to 32 bytes. |
| `RELOADLY_ENV` | Reloadly environment selector (`sandbox` or `production`) | Default `sandbox`. |
| `RELOADLY_CLIENT_ID` | Reloadly OAuth client id | Required to use `supplier-provider:reloadly`; backend only. |
| `RELOADLY_CLIENT_SECRET` | Reloadly OAuth client secret | Required to use `supplier-provider:reloadly`; backend only. |
| `RELOADLY_AUTH_URL` | Reloadly OAuth token URL | Default `https://auth.reloadly.com/oauth/token`. |
| `RELOADLY_AUDIENCE` | Reloadly OAuth audience | Defaults to the gift-card API base URL. Override per Reloadly product/API family when needed. |
| `RELOADLY_API_BASE_URL` | Legacy/default Reloadly API base URL fallback | Optional fallback used when product-family specific URLs are omitted. Prefer `RELOADLY_GIFTCARDS_BASE_URL` and `RELOADLY_AIRTIME_BASE_URL`. |
| `RELOADLY_GIFTCARDS_BASE_URL` | Reloadly gift-card API base URL | Defaults to sandbox or production gift-card host based on `RELOADLY_ENV`. |
| `RELOADLY_AIRTIME_BASE_URL` | Reloadly airtime/top-up API base URL | Defaults to sandbox or production top-up host based on `RELOADLY_ENV`. |
| `RELOADLY_SENDER_NAME` | Sender name used in default gift-card order payloads | Default `Store`. |
| `G2A_API_BASE_URL` | G2A Export API base URL | Default `https://api.g2a.com`; set the exact Export API host/version for your account. |
| `G2A_ACCESS_TOKEN` / `G2A_API_TOKEN` / `G2A_API_KEY` | G2A API credential | One is required to use `supplier-provider:g2a`; backend only. |
| `SECURITY_ALLOWED_ORIGINS` | Additional origin allow-list for sensitive POST routes | Optional; merged with `STORE_CORS` / `ADMIN_CORS` / `AUTH_CORS`. |
| `SECURITY_TRUST_PROXY_HEADERS` | Trust `X-Forwarded-For` / `X-Real-IP` for client IP resolution | Enable (`true`) only when traffic is always behind trusted proxy/load balancer. |
| `SECURITY_HEADERS_ENABLED` | Enable backend response security headers middleware | Default `true`. |
| `SECURITY_ENFORCE_ORIGIN_CHECKS` | Enforce origin/referer allow-list checks on sensitive POST routes | Default `true`. |
| `SECURITY_HSTS_MAX_AGE_SECONDS` | HSTS max-age for HTTPS requests | Set `31536000` in production HTTPS; keep `0` in local HTTP. |
| `SECURITY_HSTS_INCLUDE_SUBDOMAINS` | Add `includeSubDomains` directive to HSTS | Default `true`. |
| `SECURITY_HSTS_PRELOAD` | Add `preload` directive to HSTS | Default `false`; enable only after domain-wide HSTS readiness review. |
| `SECURITY_RATE_LIMIT_STORE` | Rate-limit state backend | Supported values: `redis`, `memory`. Defaults to `redis` in production and `memory` elsewhere. Production refuses explicit `memory`. |
| `SECURITY_RATE_LIMIT_REDIS_URL` | Redis URL for distributed rate limiting | Optional; defaults to `REDIS_URL`. Required when `SECURITY_RATE_LIMIT_STORE=redis`. |
| `SECURITY_RATE_LIMIT_REDIS_PREFIX` | Redis key prefix for rate-limit buckets | Default `store:security:rate-limit:`. Use a site/app-specific prefix for shared Redis clusters. |
| `SECURITY_RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS` | Redis connection timeout for rate limiting | Default `1000`. Requests fail closed when Redis cannot be reached. |
| `SECURITY_RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS` | Redis command timeout for rate limiting | Default `1000`. Requests fail closed when Redis cannot answer. |
| `SECURITY_RATE_LIMIT_MAX_KEYS` | In-memory cap for tracked rate-limit buckets | Default `50000`; applies only when `SECURITY_RATE_LIMIT_STORE=memory`. |
| `SECURITY_LIMIT_RECOVER_REQUEST_*` | Per-policy rate-limit knobs for `/store/orders/recover` | Supports `_MAX_REQUESTS`, `_WINDOW_SECONDS`, `_BLOCK_SECONDS`. |
| `SECURITY_LIMIT_RECOVER_VERIFY_*` | Per-policy rate-limit knobs for `/store/orders/recover/verify` | Supports `_MAX_REQUESTS`, `_WINDOW_SECONDS`, `_BLOCK_SECONDS`. |
| `SECURITY_LIMIT_CLAIM_ORDER_ACCESS_*` | Per-policy rate-limit knobs for claim endpoint | Supports `_MAX_REQUESTS`, `_WINDOW_SECONDS`, `_BLOCK_SECONDS`. |
| `SECURITY_LIMIT_CREATE_CART_PAYMENT_*` | Per-policy rate-limit knobs for cart payment creation | Supports `_MAX_REQUESTS`, `_WINDOW_SECONDS`, `_BLOCK_SECONDS`. |
| `SECURITY_LIMIT_PAYMENT_WEBHOOK_*` | Per-policy rate-limit knobs for payment webhooks | Supports `_MAX_REQUESTS`, `_WINDOW_SECONDS`, `_BLOCK_SECONDS`. |
| `SECURITY_LIMIT_ADMIN_MUTATION_*` | Per-policy rate-limit knobs for admin POST mutations | Supports `_MAX_REQUESTS`, `_WINDOW_SECONDS`, `_BLOCK_SECONDS`. |
| `EXPECT_CLOUDFLARE` | Mark production as fronted by Cloudflare for ops-control and deploy edge checks | Set `true` when DNS is proxied through Cloudflare. |
| `REQUIRE_CLOUDFLARE_SSL_MODE` | Required Cloudflare SSL mode | Use `strict` in production. |
| `CLOUDFLARE_ZONE_ID` | Cloudflare zone id used for optional SSL mode verification | Non-secret. |
| `CLOUDFLARE_API_TOKEN` | Cloudflare token with zone settings read access | Secret; never expose in UI responses. |
| `CLOUDFLARE_WAF_MANAGED_RULES_ENABLED` | Operator-attested Cloudflare managed WAF state | Set `true` only after verifying the zone. |
| `CLOUDFLARE_ACCESS_ADMIN_ENABLED` | Operator-attested Cloudflare Access or equivalent admin edge protection | Set `true` only after admin/API protection is active. |
| `STOREFRONT_PUBLIC_URL` / `API_PUBLIC_URL` | Public URLs shown in ops-control and used by deploy edge checks | Use HTTPS production origins. |
| `OPS_*` | Operator-attested VPS posture and AI operations flags | These feed `/admin/ops-control/*`; set only after machine evidence such as `pnpm deploy:vps-doctor`. |
| `PLATFORM_ENABLED_PLUGINS` | Backend plugin allow-list (comma-separated IDs). | Backend-only; public storefront plugin env is intentionally ignored by backend runtime. |
| `PLATFORM_DISABLED_PLUGINS` | Backend plugin deny-list (comma-separated IDs). | Backend-only; public storefront plugin env is intentionally ignored by backend runtime. |
| `PLATFORM_ENABLED_CONTRACTS` | Capability contract allow-list (`capability:name1,name2;...`). | Applied before plugin registration for deterministic startup behavior. |
| `PLATFORM_DISABLED_CONTRACTS` | Capability contract deny-list (`capability:name1,name2;...`). | Useful for fine-grained strategy/hook shutdown without disabling whole plugin. |
| `ORDER_ACCESS_PROVIDER_CODE` | Order access provider contract code. | Default `guest-order-access`; must resolve to an enabled `order-access-provider` contract. |
| `SITE_ID` | Logical site identifier for profile-driven multi-site runtime. | Required for profile-driven runtime (`site-1`, `jp-cards`, etc). No default fallback. |
| `SITE_ENV` | Site profile environment key (`production`, `staging`, etc). | Used with `SITE_ID` to resolve `profiles/sites/<site-id>/<site-env>/site.json`. |
| `TENANCY_MODE` | Runtime deployment mode for the site (`dedicated`, `pooled`, or `sharded`). | Current production-safe default is `dedicated`. The code is tenant-aware before pooled/shared data-plane migration. |
| `TENANT_ALLOWED_HOSTS` | Comma-separated storefront/API hosts allowed to resolve to this backend site. | Generated from the site profile during deploy. Unknown hosts fail request tenant resolution when `TENANT_FAIL_ON_HOST_MISMATCH=true`. |
| `TENANT_FAIL_ON_HOST_MISMATCH` | Fail requests whose host is not allowed for the configured site. | Keep `true` in production. |
| `TENANT_SHARED_DATA_PLANE_READY` | Explicit release-level guard for `pooled` or `sharded` modes. | Keep `false` until tenant-scoped persistence, jobs, locks, and access-control tests exist. Non-`dedicated` modes fail startup without this flag. |
| `ORDER_RECOVERY_REQUEST_COOLDOWN_SECONDS` | Cooldown before the same order/email pair can request another recovery code. | Default `60`. |
| `SUPPLIER_PROCUREMENT_RETRY_BATCH_SIZE` | Max due supplier procurements retried per cron run. | Default `25`, capped at `200`. |

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
| `MEDUSA_BACKEND_URL` | Server-side backend Store API URL used by storefront runtime routes such as `/api/health`. |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | Public URL of the backend Store API. |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Medusa publishable API key. |
| `NEXT_PUBLIC_MEDUSA_REGION_ID` | Optional fixed region id. |
| `NEXT_PUBLIC_ALLOWED_IMAGE_HOSTS` | Comma-separated image hosts or URLs allowed by Next Image remote patterns. |
| `NEXT_PUBLIC_COMMERCE_BACKEND` | Storefront commerce adapter id. | Default `medusa`; unsupported values fail early at runtime. |

Optional analytics and plugin runtime:

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Enables GA4 storefront script injection when non-empty. |
| `NEXT_PUBLIC_HOTJAR_SITE_ID` | Enables Hotjar storefront script injection when non-empty. |
| `NEXT_PUBLIC_HOTJAR_SNIPPET_VERSION` | Hotjar snippet version, default `6`. |
| `NEXT_PUBLIC_PRIVACY_BANNER_ENABLED` | Toggle storefront cookie/analytics consent banner. Default `true`. |
| `NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT` | Require explicit consent before GA4/Hotjar scripts and analytics events. Default `true`. |
| `NEXT_PUBLIC_PLATFORM_ENABLED_PLUGINS` | Storefront plugin allow-list (comma-separated IDs). |
| `NEXT_PUBLIC_PLATFORM_DISABLED_PLUGINS` | Comma-separated plugin IDs to disable on storefront (for example `analytics-hotjar,analytics-ga4`). |
| `NEXT_PUBLIC_SHOW_PLATFORM_DEMO_EXTENSIONS` | Enable demo storefront extension points for local/plugin testing. | Keep `false` outside controlled development. |
| `SITE_PROFILES_ROOT` | Filesystem path to `profiles/sites`. Defaults to `../../profiles/sites` from the storefront app. |
| `NEXT_PUBLIC_SITE_ID` | Public site identifier for profile-driven storefront rendering. |
| `NEXT_PUBLIC_SITE_ENV` | Public site profile environment key (`production`, `staging`, etc). |
| `ACCOUNT_AUTH_RATE_LIMIT_*` | Storefront BFF login/register/Google-start rate-limit knobs | Defaults to 20 requests per 600 seconds with a 900-second block. |
| `ACCOUNT_AUTH_TURNSTILE_ENABLED` | Require Cloudflare Turnstile verification for login/register BFF routes | Default `false`; enable only after the storefront submits `turnstile_token`. |
| `TURNSTILE_SECRET_KEY` | Server-side Turnstile secret used by storefront BFF routes | Secret; keep out of public `NEXT_PUBLIC_*` env. |

Do not place payment provider secrets or encryption keys in storefront env.

## Infrastructure Services

File (production scripts): `/opt/store/shared/services.env`

Required:

| Name | Purpose |
| --- | --- |
| `POSTGRES_PASSWORD` | PostgreSQL container password used by `docker-compose.yml`. |
| `REDIS_PASSWORD` | Redis password used by `docker-compose.yml` and backend `REDIS_URL`. |

Optional:

| Name | Purpose |
| --- | --- |
| `POSTGRES_BIND_IP` | Host bind IP for PostgreSQL port mapping. Default `127.0.0.1`. |
| `POSTGRES_PORT` | Host port for PostgreSQL. Default `5433`. |
| `REDIS_BIND_IP` | Host bind IP for Redis port mapping. Default `127.0.0.1`. |
| `REDIS_PORT` | Host port for Redis. Default `6380`. |

## Deployment Layout

When using the production deployment scripts, runtime env files are managed outside the release directory:

- Backend: `/opt/store/shared/backend.env`
- Storefront: `/opt/store/shared/storefront.env`
- Infrastructure services (`docker compose`): `/opt/store/shared/services.env`

Each new release symlinks these files into:

- `apps/backend/.env`
- `apps/storefront/.env.local`
