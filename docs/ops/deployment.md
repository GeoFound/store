# Deployment Guide

This repository now includes a production deployment toolchain for a single-VPS first architecture:

- `scripts/deploy/bootstrap-vps.sh`: install the VPS runtime, initialize deployment directories, generate production secrets, install systemd units, configure Caddy, and start PostgreSQL/Redis.
- `scripts/deploy/install-systemd.sh`: install backend/storefront systemd services.
- `scripts/deploy/deploy.sh`: lock, build, migrate, switch symlink, restart, health-gate, and rollback-on-failure.
- `scripts/deploy/rollback.sh`: switch to previous (or target) release and restart services.
- `scripts/deploy/edge-preflight.sh`: verify public HTTPS, HSTS, and optional Cloudflare SSL mode.
- `.github/workflows/deploy.yml`: one-click deploy/rollback from GitHub Actions.
- `.github/workflows/deploy-sites.yml`: profile-driven multi-site deployment to multiple isolated VPS targets.

`Deploy` workflow now runs `pnpm check:ci`, `pnpm acceptance:build`, and
`pnpm acceptance:live` as quality gates before remote deploy (rollback skips
these gates). The live gate creates and pays a local order, verifies delivery,
claim idempotency, and order recovery.

## Recommended First Production Shape

- 1 VPS for app runtime and stateful dependencies.
- PostgreSQL + Redis in Docker (`docker-compose.yml`).
- Medusa backend + Next.js storefront managed by `systemd`.
- Caddy/Nginx in front for HTTPS and domain routing.

This fits the current modular monolith and keeps operational complexity low while preserving a clean future scale path.

## Quick Start

1. Bootstrap the VPS runtime (run as root on server):

```bash
sudo APP_ROOT=/opt/store \
  APP_USER=store \
  STOREFRONT_DOMAIN=example.com \
  API_DOMAIN=api.example.com \
  CADDY_ADMIN_EMAIL=ops@example.com \
  bash scripts/deploy/bootstrap-vps.sh
```

This one command installs Node.js, pnpm, Docker, Caddy, git/curl/jq, creates the `store` runtime user, writes initial env files with generated secrets, installs systemd units, and starts PostgreSQL/Redis. If `STOREFRONT_DOMAIN` or `API_DOMAIN` still use the example values, Caddy is installed but the production Caddyfile is not written.

2. Fill values that cannot be generated automatically:

- `/opt/store/shared/backend.env`
- `/opt/store/shared/storefront.env`
- optional `/opt/store/shared/services.env` only if you need to override generated database/Redis passwords or bind ports

Recommended security baseline in `backend.env`:

- `SECURITY_TRUST_PROXY_HEADERS=true` (when behind reverse proxy)
- `SECURITY_ENFORCE_ORIGIN_CHECKS=true`
- `SECURITY_HEADERS_ENABLED=true`
- `SECURITY_HSTS_MAX_AGE_SECONDS=31536000` (HTTPS production only)

HTTPS / edge baseline:

- Public storefront and API endpoints must use HTTPS.
- If Cloudflare is enabled, use SSL/TLS mode `Full (strict)` (do not use `Flexible` in production).
- Stripe live webhook endpoints require HTTPS.

If analytics plugins are enabled in production, also fill:

- backend: `ANALYTICS_*`, `GA4_ENABLED`, `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`
- storefront: `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `NEXT_PUBLIC_HOTJAR_SITE_ID`, `NEXT_PUBLIC_HOTJAR_SNIPPET_VERSION`

If Resend is enabled in production, also fill:

- backend: `RESEND_ENABLED=true`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, optional `RESEND_REPLY_TO_EMAIL`

If rotating encryption keys, keep previous keys temporarily:

- backend: optional `CREDENTIAL_ENCRYPTION_KEY_PREVIOUS`, `DELIVERY_ENCRYPTION_KEY_PREVIOUS` (comma-separated)

If deploy is triggered by a non-root user, that user must have sudo permission for `systemctl` commands used by `scripts/deploy/deploy.sh` and `rollback.sh`.

3. Deploy current ref:

```bash
APP_ROOT=/opt/store bash scripts/deploy/deploy.sh --ref main
```

4. Verify health:

```bash
BACKEND_HEALTH_URL=http://127.0.0.1:9002/health \
STOREFRONT_HEALTH_URL=http://127.0.0.1:8000/api/health \
  bash scripts/deploy/health-gate.sh
```

5. Verify public HTTPS edge:

```bash
STOREFRONT_PUBLIC_URL=https://example.com \
API_PUBLIC_URL=https://api.example.com \
EXPECT_CLOUDFLARE=false \
  bash scripts/deploy/edge-preflight.sh
```

When Cloudflare is enabled and you want SSL mode verification via API:

```bash
STOREFRONT_PUBLIC_URL=https://example.com \
API_PUBLIC_URL=https://api.example.com \
EXPECT_CLOUDFLARE=true \
REQUIRE_CLOUDFLARE_SSL_MODE=strict \
CLOUDFLARE_ZONE_ID=<zone-id> \
CLOUDFLARE_API_TOKEN=<token-with-zone-settings-read> \
  bash scripts/deploy/edge-preflight.sh
```

GitHub Actions optional edge secrets (for `.github/workflows/deploy.yml`):

- `STOREFRONT_PUBLIC_URL`
- `API_PUBLIC_URL`
- `EXPECT_CLOUDFLARE` (`true` / `false`)
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_API_TOKEN`

## Rollback

Rollback to previous release:

```bash
APP_ROOT=/opt/store bash scripts/deploy/rollback.sh
```

Rollback to a specific release id:

```bash
APP_ROOT=/opt/store bash scripts/deploy/rollback.sh --to 20260511T120101Z-abc1234
```

## Pre-Release Regression (webhook/claim/recover)

Run on test/preprod host where backend, storefront, and DB container are reachable:

```bash
BACKEND_URL=http://127.0.0.1:9002 \
STOREFRONT_URL=http://127.0.0.1:8000 \
BACKEND_ENV_FILE=/opt/store/shared/backend.env \
  bash scripts/deploy/regression-webhook-claim-recover.sh
```

## Manual Webhook Signature Call

For callers/integration scripts, signed request example:

```bash
MANUAL_WEBHOOK_SECRET=replace-with-secret \
scripts/deploy/send-manual-webhook.sh --provider-order-id manual_ref_123 --status paid
```

This sends:

- `x-manual-webhook-timestamp`
- `x-manual-webhook-signature`

## Full Runbook

For cloud choices, GitHub one-click deployment, release governance, and canary strategy:

- `docs/ops/production-runbook.md`
- `docs/ops/multi-site-deployment.md`
