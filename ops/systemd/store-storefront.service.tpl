[Unit]
Description=Store Storefront (Next.js)
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=120
StartLimitBurst=20

[Service]
Type=simple
User=__APP_USER__
Group=__APP_GROUP__
WorkingDirectory=__APP_ROOT__/current
Environment=NODE_ENV=production
EnvironmentFile=__APP_ROOT__/shared/storefront.env
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/__APP_USER__/.local/bin
ExecStart=__PNPM_BIN__ --dir __APP_ROOT__/current/apps/storefront start -- --hostname 127.0.0.1 --port 8000
Restart=always
RestartSec=5
TimeoutStopSec=45
KillSignal=SIGTERM
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=full
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true
SystemCallArchitectures=native
CapabilityBoundingSet=
AmbientCapabilities=

[Install]
WantedBy=multi-user.target
