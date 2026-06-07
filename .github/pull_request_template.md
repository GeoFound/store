## Machine Evidence

- [ ] `pnpm ai:doctor`
- [ ] `pnpm ai:production`
- [ ] `pnpm check:ci`
- [ ] `pnpm profile:validate:all` when profiles, env, tenancy, or deployment behavior changed
- [ ] `pnpm ai:evidence:full` when production readiness, deployment, provider launch, or runtime behavior changed

## Production risk

- [ ] No production-risk decision gate is touched
- [ ] Production-risk gate is touched and the user decision/evidence is recorded in the conversation

## Surface Changes

- [ ] New/removed modules, routes, workflows, jobs, storefront entrypoints, site profiles, or AI scripts are registered in `.ai/inventory-baseline.json`
- [ ] Runtime env reads are registered in `.ai/config-surface.json`
- [ ] API contract, body validation, schema migration, and production config changes are registered in `.ai/production-readiness.json`
- [ ] Architecture debt was fixed or reduced; no new routine-work baseline debt was added
