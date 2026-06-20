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
## menmery attachment

This repository is one of the owner's attached workstreams. The `menmery` MCP
server (configured in `.mcp.json` for Claude Code; globally in Codex config)
connects it to the owner's single shared brain.

- For stateful turns (long-lived state, current subject, prior decisions, open
  loops, cross-project status — including "what is this repo / what's next"),
  call `menmery.entry_turn(message=..., max_depth="auto")` FIRST, then layer
  repo files on top.
- Capture durable deltas (decisions, evidence, open loops, abandoned paths)
  through `menmery.remember(...)`; runtime routes canonical vs. inbox staging.
- Purely local code edits do not need a brain call.
- Artifact truth beats any brain or caller claim: verify files/git/tests before
  treating "completed" as done.
- If the MCP server is unavailable, report the attachment gap; do not
  substitute repo files for long-lived brain state.
