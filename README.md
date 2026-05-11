# Single Store Digital Goods

单店自营虚拟数字商品独立站。

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
- [Production runbook](docs/ops/production-runbook.md)
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
pnpm check:ci
pnpm dev:check
pnpm acceptance
```

Live runtime verification with real local services:

```bash
pnpm acceptance:live
```

When both dev servers are running:

```bash
pnpm health
```

Default local URLs:

- Storefront: http://localhost:8000
- Medusa backend: http://localhost:9002
- Medusa Admin: http://localhost:9002/app

## Backup

```bash
pnpm backup:db
pnpm restore:db backups/store-YYYYMMDDTHHMMSSZ.dump
```
