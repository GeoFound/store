# Multi-Site Deployment (Shared Codebase, Isolated VPS)

This repository now supports a profile-driven multi-site model:

- One shared codebase.
- One isolated runtime stack per site (separate VPS, DB, Redis, secrets).
- One GitHub Actions workflow dispatch to deploy selected sites in parallel.

## 1. Site Profile Structure

Each site keeps non-secret differences in:

- `profiles/sites/<site-id>/<site-env>/site.json`

Example environments:

- `production`
- `staging`
- `development`

Profile data drives:

- Storefront brand/content/theme metadata.
- Backend/storefront plugin toggles.
- Site-level CORS defaults derived from domains.

Storefront profiles can now tune the first-screen storefront without code
changes:

- `theme.id`, colors, border, status colors, radius, and density.
- `content.home.featured_limit` and `content.home.announcements`.
- `content.categories.links` for pinned homepage category entry points.
- `content.catalog` labels for product listing filters and sorting.

## 2. Deployment Targets

Deployment targets are listed in:

- `profiles/targets.json`

Each target entry includes:

- `site_id`
- `site_env`
- `enabled`
- `github_environment`
- secret-name pointers for host, ssh user/key, repo path, app root, and base env content.

Only targets with `enabled=true` are eligible.
Repository sample is configured as "single active site":

- `site-1` is enabled.
- other sites remain disabled until needed.

## 3. Required GitHub Secrets Per Target

Each target points to these secret values:

- `DEPLOY_HOST_*`
- `DEPLOY_SSH_USER_*`
- `DEPLOY_SSH_PRIVATE_KEY_*`
- `DEPLOY_HOST_KEY_*`
- `DEPLOY_REPO_PATH_*`
- `APP_ROOT_*` (optional, default `/opt/store` when empty)
- `BACKEND_ENV_*` (full backend env content)
- `STOREFRONT_ENV_*` (full storefront env content)
- `SERVICES_ENV_*` (full postgres/redis env content)

The workflow appends profile-driven overrides on top of backend/storefront env content.

For the active `site-1` sample target, define:

- `DEPLOY_HOST_SITE_1`
- `DEPLOY_SSH_USER_SITE_1`
- `DEPLOY_SSH_PRIVATE_KEY_SITE_1`
- `DEPLOY_HOST_KEY_SITE_1`
- `DEPLOY_REPO_PATH_SITE_1`
- `APP_ROOT_SITE_1`
- `BACKEND_ENV_SITE_1`
- `STOREFRONT_ENV_SITE_1`
- `SERVICES_ENV_SITE_1`

## 4. VPS Bootstrap (One-Time per Site)

On each VPS:

1. Bootstrap folders and placeholder files:

```bash
sudo APP_ROOT=/opt/store APP_USER=store bash scripts/deploy/bootstrap-vps.sh
```

2. Install systemd services:

```bash
sudo APP_ROOT=/opt/store APP_USER=store bash scripts/deploy/install-systemd.sh
```

3. Start postgres/redis services:

```bash
APP_ROOT=/opt/store pnpm services:up:prod
```

4. Configure reverse proxy domains (Caddy/Nginx).

## 5. Workflow: Deploy Sites

Use GitHub Actions workflow:

- `.github/workflows/deploy-sites.yml`

Inputs:

- `ref`: branch/tag/sha.
- `site_env`: profile environment (`production` by default).
- `targets`: `all` or comma-separated site ids.
- `run_db_migrations`: `true`/`false`.
- `run_edge_preflight`: `true`/`false` (default `true`).

Execution model:

1. Runs shared quality gate once.
2. Resolves enabled targets from `profiles/targets.json`.
3. Deploys targets in parallel:
  - validates profile,
  - materializes backend/storefront/services env,
  - syncs env files to `<APP_ROOT>/shared/`,
  - executes existing `scripts/deploy/deploy.sh` remotely,
  - runs `edge-preflight` automatically with profile domains (`https://<storefront-domain>`, `https://<api-domain>`).

## 6. Local Profile Validation

Validate all profiles:

```bash
pnpm profile:validate:all
```

Validate one profile:

```bash
pnpm profile:validate -- --site-id site-1 --site-env production
```

Show computed backend overrides:

```bash
pnpm profile:export-overrides -- --site-id site-1 --site-env production --target backend
```

## 7. Runtime Notes

- Storefront reads profile at runtime via `SITE_ID` and `SITE_ENV`.
- `SITE_PROFILES_ROOT` can override the profile root; the default storefront
  release layout expects `../../profiles/sites` from `apps/storefront`.
- `SITE_ID` and `SITE_ENV` must resolve to an exact
  `<site-id>/<site-env>/site.json`; missing environment profiles fail startup
  instead of falling back to another environment.
- Production sites should expose storefront/API through HTTPS only.
- If Cloudflare is used per site, set zone SSL/TLS mode to `Full (strict)`.

This keeps each site independently deployable while preserving one shared engineering base.
