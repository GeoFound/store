# Local Acceptance

Run the build-level acceptance check:

```bash
pnpm dev:check
pnpm acceptance
```

`pnpm dev:check` is the daily local sanity command. By default it validates toolchain/env, ensures PostgreSQL and Redis are running, then runs migration + backend build + storefront lint/build.

Optional modes:

```bash
pnpm dev:check:quick   # env + infra only
pnpm dev:check:full    # includes pnpm test
pnpm dev:check:live    # includes live purchase smoke
```

This verifies:

- PostgreSQL and Redis start.
- Medusa migrations run.
- Backend builds.
- Storefront lints.
- Storefront builds.

`pnpm acceptance` defaults to `SITE_ID=site-1`, `SITE_ENV=development`, and
`SITE_PROFILES_ROOT=profiles/sites` from the repository root. Override those
variables when validating a different local site profile.

For live endpoint checks, start both apps:

```bash
pnpm dev:backend
pnpm dev:storefront
```

Then run:

```bash
pnpm health
```

For a full live purchase smoke test with local services and seeded credential inventory:

```bash
pnpm acceptance:live
```

If you run backend/storefront outside `acceptance:live`, ensure both the backend and smoke script share the same manual webhook secret:

```bash
export MANUAL_WEBHOOK_SECRET=replace-with-strong-shared-secret
```

Also ensure backend runtime encryption keys are valid 32-byte values:

```bash
export CREDENTIAL_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
export DELIVERY_ENCRYPTION_KEY=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789
# Optional during key rotation (comma-separated list)
export CREDENTIAL_ENCRYPTION_KEY_PREVIOUS=
export DELIVERY_ENCRYPTION_KEY_PREVIOUS=
```

This creates a cart, reserves inventory, confirms manual payment through the webhook, claims order access, and verifies that at least one delivery record with non-empty payload is readable from the order access endpoint.

## Manual Full Flow Checklist

1. Open storefront at `http://localhost:8000`.
2. Add a product to cart.
3. Checkout as guest with email only.
4. Create a manual payment attempt.
5. Mark payment paid in Admin payments page, by Admin API, or by webhook.
6. Confirm inventory item changes to `sold`.
7. Confirm an inventory-backed delivery record was created automatically; use Admin deliveries page or Admin API only for manual/open-ended products or replacement delivery.
8. Open `/orders` and enter the order access token.
9. Confirm delivery.
10. Submit an after-sales request.
11. Process after-sales request through Admin after-sales page or Admin API.
12. Check Admin audit logs page contains sensitive operations.
13. If analytics is enabled, check Admin analytics page (`/app/analytics`) shows:
    - `begin_checkout`/`purchase` related events
    - destination dispatch rows with expected status transitions (`pending` -> `delivered` or retry states)

## Local URLs

- Storefront: `http://localhost:8000`
- Backend: `http://localhost:9002`
- Admin: `http://localhost:9002/app`
- Admin credentials: `http://localhost:9002/app/credentials`
- Admin deliveries: `http://localhost:9002/app/deliveries`
- Admin after-sales: `http://localhost:9002/app/after-sales`
- Admin audit logs: `http://localhost:9002/app/audit-logs`
- Admin payments: `http://localhost:9002/app/payments`
- Backend health: `http://localhost:9002/health`
- Storefront health: `http://localhost:8000/api/health`

## Credential Batch Paste Formats

The Admin credentials page accepts one credential per line:

```text
demo1----secret1
demo2,secret2
demo3|secret3
demo4:secret4
CARD-AAAA-BBBB-CCCC
```

It also accepts JSON object lines or a full JSON array when structured metadata is needed.
