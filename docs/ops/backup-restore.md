# Backup And Restore

PostgreSQL is the system of record. Redis is used for cache, locks, and queues; Redis data can be rebuilt for this first version.

## Backup

Create a compressed PostgreSQL dump:

```bash
pnpm backup:db
```

The script writes to `backups/store-<timestamp>.dump`.

## Restore

Restore into the local `store-postgres` container:

```bash
pnpm restore:db backups/store-YYYYMMDDTHHMMSSZ.dump
```

This drops and recreates the `store` database.

## Production Policy

- Run daily database backups.
- Keep at least 7 daily and 4 weekly backups.
- Store at least one copy off the VPS.
- Test restore on a separate machine before trusting backups.
- Back up before running migrations.

## Secrets

Database backups do not include `.env` files. Keep a separate secure backup of:

- `DATABASE_URL`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `CREDENTIAL_ENCRYPTION_KEY`
- `CREDENTIAL_ENCRYPTION_KEY_PREVIOUS` (if rotation window is active)
- `DELIVERY_ENCRYPTION_KEY`
- `DELIVERY_ENCRYPTION_KEY_PREVIOUS` (if rotation window is active)
- `RESEND_API_KEY` (if Resend is enabled)
- Payment provider secrets when added

Without encryption keys, stored credentials and delivery snapshots cannot be decrypted.
