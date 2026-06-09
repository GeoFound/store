# Backup And Restore

PostgreSQL is the system of record. Redis is used for cache, locks, and queues; Redis data can be rebuilt for this first version.

## Backup

Create an encrypted compressed PostgreSQL dump:

```bash
BACKUP_ENCRYPTION_KEY="$(openssl rand -base64 32)" BACKUP_ENCRYPTION_REQUIRED=1 pnpm backup:db
```

The script writes to `backups/store-<timestamp>.dump.enc` when `BACKUP_ENCRYPTION_KEY` is present. The production bootstrap writes `/opt/store/shared/ops.env` with `BACKUP_ENCRYPTION_REQUIRED=1` and a generated backup key; backup and restore scripts load that file automatically when it exists. The key must decode to 32 bytes and must be stored outside the backup directory. Without `BACKUP_ENCRYPTION_KEY`, the script can still write `backups/store-<timestamp>.dump` for local development; production jobs should set `BACKUP_ENCRYPTION_REQUIRED=1`.

## Restore

Restore into a non-production container:

```bash
POSTGRES_CONTAINER=store-restore-test pnpm restore:db backups/store-YYYYMMDDTHHMMSSZ.dump.enc
```

The restore script refuses to target the default `store-postgres` container unless `RESTORE_ALLOW_PRODUCTION_CONTAINER=1` is set. Use that override only during a declared incident or controlled production recovery.

## Restore Drill

Run a disposable restore drill against the latest backup:

```bash
BACKUP_ENCRYPTION_KEY=... pnpm backup:restore-drill backups/store-YYYYMMDDTHHMMSSZ.dump.enc
```

The drill starts a temporary PostgreSQL container, restores the dump, verifies public tables exist, prints JSON evidence, and removes the container unless `RESTORE_DRILL_KEEP_CONTAINER=1`.

## Secret Rotation

Rotate encrypted payload keys by setting the new primary key, keeping old keys in the corresponding `_PREVIOUS` variables, and dry-running first:

```bash
BACKEND_ENV_FILE=/opt/store/shared/backend.env pnpm secrets:rotate
BACKEND_ENV_FILE=/opt/store/shared/backend.env ROTATION_APPLY=1 pnpm secrets:rotate
```

After the applied run succeeds and runtime health passes, remove retired `_PREVIOUS` keys from the env file and restart the backend.

## Production Policy

- Run daily database backups.
- Keep at least 7 daily and 4 weekly backups.
- Encrypt every production backup artifact.
- Store at least one encrypted copy off the VPS.
- Test restore on a separate target before trusting backups.
- Back up before running migrations.
- Record `OPS_BACKUP_ENCRYPTION_ENABLED=true` and `OPS_BACKUP_LAST_RESTORE_TEST_AT=<UTC timestamp>` only after machine evidence exists.

## Secrets

Database backups do not include `.env` files. Keep a separate secure backup of:

- `DATABASE_URL`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `CREDENTIAL_ENCRYPTION_KEY`
- `CREDENTIAL_ENCRYPTION_KEY_PREVIOUS` (if rotation window is active)
- `DELIVERY_ENCRYPTION_KEY`
- `DELIVERY_ENCRYPTION_KEY_PREVIOUS` (if rotation window is active)
- `SUPPLIER_ENCRYPTION_KEY`
- `SUPPLIER_ENCRYPTION_KEY_PREVIOUS` (if rotation window is active)
- `BACKUP_ENCRYPTION_KEY`
- `RESEND_API_KEY` (if Resend is enabled)
- Payment provider secrets when added

Without encryption keys, stored credentials and delivery snapshots cannot be decrypted.
