[Unit]
Description=Store Backend (Medusa)
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service
StartLimitIntervalSec=120
StartLimitBurst=20

[Service]
Type=simple
User=__APP_USER__
Group=__APP_GROUP__
WorkingDirectory=__APP_ROOT__/current
Environment=NODE_ENV=production
EnvironmentFile=__APP_ROOT__/shared/backend.env
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/__APP_USER__/.local/bin
ExecStart=__PNPM_BIN__ --dir __APP_ROOT__/current/apps/backend start
Restart=always
RestartSec=5
TimeoutStopSec=45
KillSignal=SIGTERM
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
