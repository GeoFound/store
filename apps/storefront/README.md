# Storefront

Next.js storefront for the independent digital goods store.

## Development

Run from the repository root:

```bash
pnpm dev:storefront
```

The storefront runs on `http://localhost:8000`.

Profiles are loaded from `profiles/sites/<SITE_ID>/<SITE_ENV>/site.json`.
Set `NEXT_PUBLIC_SITE_ID` or `SITE_ID`, and optionally `NEXT_PUBLIC_SITE_ENV`
or `SITE_ENV`, before running against a non-default profile.

## Checks

```bash
pnpm --dir apps/storefront test
pnpm --dir apps/storefront lint
pnpm --dir apps/storefront exec tsc --noEmit
pnpm profile:validate:all
pnpm site:validate:all
```

Experience page and section contracts are defined in
`.ai/storefront-experience-policy.json`.
