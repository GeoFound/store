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

## Admin Boundary

- Browser admin components import product operations from
  `apps/admin/src/lib/product-admin-api.ts`.
- `product-admin-api.ts` is the anti-corruption facade over the current
  same-origin Admin BFF. It owns `/admin/*` route strings, request body mapping,
  and product DTO mapping from current backend response shapes to UI contracts.
- Product, publishing, and credential inventory UI consumes camelCase
  product-admin DTOs. It must not read Medusa or backend snake_case response
  fields such as product variant IDs, template codes, handler codes, or stock
  counters directly.
- Order and customer UI follows the same rule for order, payment, fulfillment,
  customer account, and group fields.
- Payment, digital delivery, and after-sales UI follows the same rule for
  payment attempts, payment channels, delivery records, pending delivery items,
  and support request fields.
- Supplier UI follows the same rule for provider capabilities, variant
  mappings, external provider order identifiers, and procurement records.
- SEO UI follows the same rule for SEO documents, audit summaries, audit
  results, and Search Console performance fields.
- Analytics and audit-log UI follows the same rule for analytics events,
  dispatch queue records, audit actors, audited entities, risk levels, and
  audit metadata.
- System settings UI follows the same rule for store defaults, currencies,
  locales, admin users, regions, sales channels, API keys, feature flags, and
  plugin visibility.
- AI and ops UI follows the same rule for provider readiness, AI task plugins,
  task runs, control-panel summaries, operational sections, findings, and
  human-gate metadata.
- Marketing UI follows the same rule for campaigns, offers, coupons, referral
  links, marketing touchpoints, redemption counters, attribution fields, and
  route ownership.
- Content UI follows the same rule for content entries, storage providers,
  assets, audio records, AI task runs, publishing actions, upload policy
  previews, and content review workflow fields.

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
