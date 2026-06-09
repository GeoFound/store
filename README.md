# Single Store Digital Goods

单店优先、可扩展到多站的虚拟数字商品独立站基座。

## Stack

- Medusa backend and Admin
- Next.js storefront
- PostgreSQL
- Redis

## Docs

- [Spec](docs/independent-store-spec.md)
- [AI build task](docs/ai-build-task.yaml)
- [Environment variables](docs/ops/environment.md)
- [Deployment guide](docs/ops/deployment.md)
- [Multi-site deployment](docs/ops/multi-site-deployment.md)
- [Production runbook](docs/ops/production-runbook.md)
- [Supplier procurement](docs/ops/supplier-procurement.md)
- [Marketing engine](docs/marketing-engine.md)
- [Analytics module](docs/analytics.md)
- [Backup and restore](docs/ops/backup-restore.md)
- [Local acceptance](docs/ops/local-acceptance.md)
- [Plugin platform task](docs/roadmap/plugin-platform.md)

## Local Services

```bash
pnpm services:up
pnpm db:migrate
```

Backend env requires `CREDENTIAL_ENCRYPTION_KEY` as a 32-byte base64 or hex key.
The local `.env` has a development key; production must use a separate secret.

## Development

Backend and storefront are scaffolded under `apps/`.

```bash
pnpm dev:backend
pnpm dev:storefront
```

## Verification

```bash
pnpm ai:context
pnpm ai:doctor
pnpm ai:status
pnpm check:ci
pnpm dev:check
pnpm acceptance
```

AI-first repository operation is encoded in `AGENTS.md` and `.ai/*.json`.
Use `pnpm ai:evidence` for a machine-readable evidence report, and
`pnpm ai:evidence:full` before production-risk changes.

Live runtime verification with real local services:

```bash
pnpm acceptance:live
```

Production edge verification (public HTTPS / optional Cloudflare):

```bash
STOREFRONT_PUBLIC_URL=https://example.com \
API_PUBLIC_URL=https://api.example.com \
EXPECT_CLOUDFLARE=false \
  pnpm deploy:edge

API_PUBLIC_URL=https://api.example.com \
EXPECT_CLOUDFLARE=true \
EXPECT_CLOUDFLARE_ACCESS=true \
  pnpm deploy:admin-edge

BACKEND_URL=https://api.example.com \
BACKEND_ENV_FILE=/opt/store/shared/backend.env \
  pnpm deploy:rate-limit
```

When both dev servers are running:

```bash
pnpm health
```

Default local URLs:

- Storefront: http://localhost:8000
- Medusa backend: http://localhost:9002
- Medusa Admin: http://localhost:9002/app

Profile-driven runtime requires `SITE_ID` / `SITE_ENV` (backend) and
`NEXT_PUBLIC_SITE_ID` / `NEXT_PUBLIC_SITE_ENV` (storefront). There is no default
site fallback.

## Backup

```bash
BACKUP_ENCRYPTION_KEY=... BACKUP_ENCRYPTION_REQUIRED=1 pnpm backup:db
BACKUP_ENCRYPTION_KEY=... pnpm backup:restore-drill backups/store-YYYYMMDDTHHMMSSZ.dump.enc
POSTGRES_CONTAINER=store-restore-test BACKUP_ENCRYPTION_KEY=... pnpm restore:db backups/store-YYYYMMDDTHHMMSSZ.dump.enc
```
