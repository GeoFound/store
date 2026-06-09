# AI VPS Operations

`ops-control` is the backend control-plane surface for production operations.
It exposes read-only, redacted admin API snapshots:

- `GET /admin/ops-control/dashboard`
- `GET /admin/ops-control/security`
- `GET /admin/ops-control/maintenance`

The module owns operations visibility only. It does not store plaintext secrets
and does not execute host commands from the backend.

## Evidence Flow

On the VPS, run:

```bash
APP_ROOT=/opt/store \
VPS_DOCTOR_OUTPUT=/opt/store/shared/logs/vps-doctor-latest.json \
  pnpm deploy:vps-doctor
```

The script checks systemd services and unit users, local health endpoints, Docker
containers, Docker socket permissions, whether `APP_USER` has Docker access,
disk and memory pressure, latest encrypted PostgreSQL backup, SSH posture, UFW,
and unattended security updates. It writes JSON evidence when
`VPS_DOCTOR_OUTPUT` is set.

After verification, set the related `OPS_*` flags in
`/opt/store/shared/backend.env`. Treat these flags as operator-attested state;
do not set them to `true` until the machine evidence exists.

## AI Review

`ops-control` registers an AI task plugin:

- `ops.vps_maintenance_review`

`ai-core` lists this task in the AI control surface. The task reads the
ops-control snapshot and returns a human-reviewed risk summary. High-risk
actions remain decision gates:

- rollback
- service restart
- system upgrades
- DNS or Cloudflare policy changes
- firewall changes
- database restore or migration

Keep `OPS_AI_AUTO_REMEDIATE_ENABLED=false` unless a narrow command allow-list,
approval flow, and audit trail are implemented.
