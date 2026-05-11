# Deployment Guide

This repository now includes a production deployment toolchain for a single-VPS first architecture:

- `scripts/deploy/bootstrap-vps.sh`: initialize deployment directories and env placeholders.
- `scripts/deploy/install-systemd.sh`: install backend/storefront systemd services.
- `scripts/deploy/deploy.sh`: lock, build, migrate, switch symlink, restart, health-gate, and rollback-on-failure.
- `scripts/deploy/rollback.sh`: switch to previous (or target) release and restart services.
- `.github/workflows/deploy.yml`: one-click deploy/rollback from GitHub Actions.

## Recommended First Production Shape

- 1 VPS for app runtime and stateful dependencies.
- PostgreSQL + Redis in Docker (`docker-compose.yml`).
- Medusa backend + Next.js storefront managed by `systemd`.
- Caddy/Nginx in front for HTTPS and domain routing.

This fits the current modular monolith and keeps operational complexity low while preserving a clean future scale path.

## Quick Start

1. Bootstrap server directories (run as root on server):

```bash
sudo APP_ROOT=/opt/store APP_USER=store bash scripts/deploy/bootstrap-vps.sh
```

2. Fill secrets and origins:

- `/opt/store/shared/backend.env`
- `/opt/store/shared/storefront.env`

3. Install systemd units (run as root on server):

```bash
sudo APP_ROOT=/opt/store APP_USER=store bash scripts/deploy/install-systemd.sh
```

4. Start infrastructure on server:

```bash
pnpm services:up
```

If deploy is triggered by a non-root user, that user must have sudo permission for `systemctl` commands used by `scripts/deploy/deploy.sh` and `rollback.sh`.

5. Deploy current ref:

```bash
APP_ROOT=/opt/store bash scripts/deploy/deploy.sh --ref main
```

6. Verify health:

```bash
BACKEND_HEALTH_URL=http://127.0.0.1:9002/health \
STOREFRONT_HEALTH_URL=http://127.0.0.1:8000/api/health \
  bash scripts/deploy/health-gate.sh
```

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
