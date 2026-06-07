---
name: store-ai-maintainer
description: Use when maintaining, reviewing, refactoring, or extending this independent digital goods store repository. Covers AI cold start, machine evidence, architecture boundary hygiene, module decoupling, product expansion, and production-readiness checks.
---

# Store AI Maintainer

## Entry

Start with machine context:

```bash
pnpm ai:context
pnpm ai:doctor
```

Then run the focused checks that match the task:

- Architecture or refactor work: `pnpm ai:architecture`
- Repository/product surface changes: `pnpm ai:inventory`
- Runtime configuration or profile work: `pnpm ai:config` and `pnpm profile:validate:all`
- Routine implementation: `pnpm check:ci`
- Production-readiness work: `pnpm ai:evidence:full`

Read `.ai/system.json`, `.ai/system-map.json`, `.ai/taskbook.json`, `.ai/architecture-rules.json`, `.ai/architecture-baseline.json`, and `.ai/inventory-baseline.json` before making broad changes.

## Decision Gates

AI can implement, refactor, test, and document routine engineering work.

Ask the user only for:

- Business direction: product line, market, pricing model, user promise.
- Production risk: go-live, rollback, irreversible migration, payment-provider launch.
- External account or secret: API keys, DNS, provider approval, legal/compliance copy.

When asking, state the exact decision, options, tradeoffs, and the evidence that will verify the result.

## Architecture Rules

Use `pnpm ai:architecture` as the first pass for decoupling health. It uses dependency-cruiser plus AST probes; `require()`, dynamic `import()`, fetch aliases, storefront `/store/` literals, and route helper growth are in scope.

Existing architecture warnings are only acceptable if `.ai/architecture-baseline.json` has fingerprint, owner, rationale, target, and non-expired `expiresAt`. New warnings, growth in baselined hotspots, expired baseline entries, or PR-added architecture baseline fingerprints are failures.

Use `pnpm ai:inventory` whenever a change adds or removes modules, API routes, workflows, jobs, storefront entrypoints, site profiles, or AI scripts. Every tracked surface entry must be an object with owner and verification commands. Backend modules must also be represented in `.ai/system-map.json`, or have an explicit expiring unmapped-module baseline.

Default direction:

- Platform core in `apps/backend/src/platform` owns contracts and runtime APIs only.
- `platform-adapters` owns Medusa container/service binding.
- Backend modules should avoid importing `platform-adapters` or other modules directly.
- API routes should stay thin; move query shaping and domain orchestration into helpers when route files grow.
- Storefront UI should call `apps/storefront/src/lib/commerce.ts`, not backend endpoints directly.
- New runtime env keys must be registered in `.ai/config-surface.json`; dynamic env access must be listed in `scan.allowedDynamicAccess` or constrained by `scan.allowedDynamicPatterns`.
- New repository/product surface must be registered in `.ai/inventory-baseline.json`.
- New product/site expansion must update profiles, system map, evidence commands, and tests as needed.

## Change Flow

For new features or refactors:

1. Use `pnpm ai:context` output to identify the owning node and verification commands.
2. Prefer existing platform ports, module services, workflows, and adapters over new cross-module imports.
3. Do not add architecture baseline fingerprints during routine work. Fix the boundary or reduce the hotspot; PR CI blocks new baseline fingerprints against the base commit.
4. Update `.ai/system-map.json`, `.ai/taskbook.json`, `.ai/inventory-baseline.json`, or `.ai/architecture-rules.json` when the repository shape changes.
5. Run focused tests first, then `pnpm check:ci` when the change can affect shared behavior.

## Review Output

Lead with objective findings:

- Failed commands and exact error.
- Architecture warnings that block independent evolution.
- Inventory changes that are not registered.
- Missing tests or evidence.
- Concrete next action and the command that will verify it.

Do not treat human review, prose, or screenshots as acceptance unless the relevant machine evidence also exists.
