# Environment Variables

This project has two runtime apps: Medusa backend and Next.js storefront.

## Backend

File: `apps/backend/.env`

Required:

| Name | Purpose | Production note |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Use a strong DB password and private network address. |
| `REDIS_URL` | Redis connection string | Use private network address. |
| `JWT_SECRET` | Medusa auth JWT signing secret | Generate a long random value. |
| `COOKIE_SECRET` | Medusa cookie signing secret | Generate a long random value, different from `JWT_SECRET`. |
| `MANUAL_WEBHOOK_SECRET` | HMAC secret for `/hooks/payment/manual` signatures | Must be shared only with trusted webhook caller. Rotate periodically. |
| `MANUAL_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS` | Manual webhook timestamp tolerance window | Default `300`. Keep small to reduce replay window. |
| `ORDER_RECOVERY_MAX_FAILED_ATTEMPTS` | Max failed verify attempts before temporary block | Default `5`. |
| `ORDER_RECOVERY_BLOCK_SECONDS` | Temporary block duration for recovery verification | Default `600` seconds. |
| `CREDENTIAL_ENCRYPTION_KEY` | AES-256-GCM key for inventory credentials | Must decode to 32 bytes. Do not rotate without a migration plan. |
| `DELIVERY_ENCRYPTION_KEY` | AES-256-GCM key for delivery snapshots | Must decode to 32 bytes. Can fall back to credential key locally, but keep separate in production. |
| `STORE_CORS` | Allowed storefront origins | Set to the public storefront origin. |
| `ADMIN_CORS` | Allowed Admin origins | Set to the Admin/backend origin. |
| `AUTH_CORS` | Allowed auth origins | Include Admin and storefront origins. |
| `PORT` | Backend port | Local default is `9002`. |

Generate a 32-byte base64 key:

```bash
openssl rand -base64 32
```

## Storefront

File: `apps/storefront/.env.local`

Required:

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | Public URL of the backend Store API. |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Medusa publishable API key. |
| `NEXT_PUBLIC_MEDUSA_REGION_ID` | Optional fixed region id. |

Do not place payment provider secrets or encryption keys in storefront env.

## Deployment Layout

When using the production deployment scripts, runtime env files are managed outside the release directory:

- Backend: `/opt/store/shared/backend.env`
- Storefront: `/opt/store/shared/storefront.env`

Each new release symlinks these files into:

- `apps/backend/.env`
- `apps/storefront/.env.local`
