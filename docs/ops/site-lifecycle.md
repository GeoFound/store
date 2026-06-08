# Site Lifecycle Gates

This repository treats each site as a launchable product surface. Every site must have `development`, `staging`, and `production` profiles under `profiles/sites/<site-id>/`.

The lifecycle contract is machine-readable in `.ai/site-lifecycle-policy.json` and enforced by `scripts/site/lifecycle.mjs`.

## Commands

```bash
pnpm site:validate:all
pnpm site:evidence:all
pnpm site:evidence -- --site-id jp-cards --site-env staging
pnpm site:gate -- --site-id jp-cards --site-env production
```

`validate` checks profile shape and policy compliance. `evidence` writes a local report under `.ai-trace/sites/<site-id>/<site-env>/`. `gate` fails unless the selected profile has all promotion evidence refs required for that environment.

These commands do not deploy, push user data, or write to graph. They only validate local repository state and local evidence references.

## Environment Rules

Development is for local fixtures and test data. It may omit runtime evidence commands.

Staging must look like production operationally but must keep real user data, `production_real_tenant` evidence, graph production writes, and supplier auto procurement disabled.

Production requires:

- staging profile present
- runtime health evidence
- Cloudflare or edge preflight evidence
- checkout/recovery regression evidence
- backup evidence
- restore-test evidence
- rollback evidence
- staging evidence reference
- human gate reference

Human approval is a gate input, not a replacement for runtime proof.

## Graph And Real Data

The current graph adapter path is local/staging dry-run only. Without a deployed receiving endpoint, PII/consent review, idempotency and trace coverage proof, and human approval, a site must not claim `production_real_tenant` evidence or enable graph production writes.

When a real site is deployed, write the external evidence refs into the selected production profile and rerun:

```bash
pnpm profile:validate:all
pnpm site:gate -- --site-id <site-id> --site-env production
pnpm ai:evidence:full
```
