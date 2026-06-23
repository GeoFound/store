# Decoupling Boundaries

This project keeps business capabilities behind explicit ports so modules,
storefront UI, and backend adapters can evolve independently.

## Backend Boundary

- `apps/backend/src/platform` defines platform contracts, events, registries,
  and runtime APIs. It must not import backend framework packages such as
  `@medusajs/*`.
- Backend-specific containers enter the platform through
  `BackendRuntimeContext`, a minimal `resolve(token)` interface.
- Medusa modules, API routes, workflows, models, migrations, and service
  implementations are the current backend adapter layer. They may use Medusa
  APIs, but platform contracts should not require Medusa types.
- Module implementations can resolve current services through the backend
  adapter layer in `platform-adapters/services`, but capability callers should
  prefer platform ports such as payment providers, inventory handlers, delivery
  handlers, supplier providers, marketing strategies, order access providers,
  and hooks.

## Storefront Boundary

- UI components and pages import commerce operations from
  `apps/storefront/src/lib/commerce.ts`.
- `commerce.ts` defines the backend-neutral commerce port.
- `commerce-medusa.ts` is the current adapter. Replacing the backend should
  replace or route this adapter, not require sweeping UI changes.

## Rule Of Thumb

Framework imports belong at the edges. Core contracts should describe what the
store needs, not which framework currently implements it.

## Backend Replacement Readiness

- `.ai/backend-decoupling-readiness.json` is the machine-readable replacement
  readiness policy. It treats Medusa as the current runtime adapter and records
  no-growth budgets for existing Medusa binding.
- `pnpm ai:backend-decoupling` enforces hard-zero boundaries for platform core,
  browser admin direct coupling, and storefront raw fetch drift. It also fails
  if baselined Medusa runtime coupling grows before a neutral facade or
  application port replaces it.
- Backend replacement should proceed by strangler slices: typed admin facade,
  framework-neutral use cases, data portability, shadow backend compatibility,
  then cutover gates. A big-bang rewrite is not the target path.
