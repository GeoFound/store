# AI Operating Rules

This repository is the engineering system that builds and evolves the product.
The product is the independent digital goods store implemented by this
repository.

Use machine evidence before narrative judgment:

1. Start with `pnpm ai:context` and `pnpm ai:doctor`.
2. Prefer executable checks, scripts, fixtures, tests, smoke runs, and generated
   evidence over human document review.
3. Human review is not an acceptance gate by itself. If a human decision is
   required, ask in the conversation with the exact decision, options, tradeoffs,
   and the evidence needed to verify the result.
4. AI may implement, refactor, test, document, and maintain without stopping for
   approval unless the change hits a decision gate in `.ai/system.json`.
5. Production readiness requires objective proof: CI, profile validation,
   runtime health, deployment checks, backup/rollback evidence, and security
   controls.
6. Keep repository facts machine-readable in `.ai/*.json`; keep prose short and
   only where it improves AI cold start.

Primary machine entry points:

- `pnpm ai:context`
- `pnpm ai:doctor`
- `pnpm ai:evidence`
- `pnpm ai:evidence:full`
