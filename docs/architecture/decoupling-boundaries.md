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
- Module implementations can resolve current services through
  `platform/services`, but capability callers should prefer platform ports such
  as payment providers, inventory handlers, delivery handlers, supplier
  providers, marketing strategies, order access providers, and hooks.

## Storefront Boundary

- UI components and pages import commerce operations from
  `apps/storefront/src/lib/commerce.ts`.
- `commerce.ts` defines the backend-neutral commerce port.
- `commerce-medusa.ts` is the current adapter. Replacing the backend should
  replace or route this adapter, not require sweeping UI changes.

## Rule Of Thumb

Framework imports belong at the edges. Core contracts should describe what the
store needs, not which framework currently implements it.
