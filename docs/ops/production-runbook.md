# 生产部署 Runbook（完整链路）

本文是当前仓库可直接落地的生产发布方案，目标是：

- 先在当前架构下稳定上线（不是简陋 demo）。
- 能一键发布、可回滚、可健康门禁。
- 支持本地改代码 -> push GitHub -> 服务器远端拉取并发布。
- 为后续扩容（多机、灰度、金丝雀）预留路径。

## 1. 云主机选择建议

当前阶段建议：单 VPS 起步。

原因：

- 这个仓库是单店、模块化单体（backend + storefront），单机运维成本最低。
- 交易量不大时，单 VPS 足够并且故障面小。
- 已经具备发布、回滚、备份能力，先把流程跑稳比早期分布式更关键。

推荐起步规格（生产初期）：

- 4 vCPU / 8 GB RAM / 120+ GB SSD
- Ubuntu 22.04 LTS 或 24.04 LTS

不建议一开始就上复杂多节点，除非你已经有明确高并发/高可用目标（例如多可用区 SLA）。

## 2. 目标拓扑

- 反向代理：Caddy（HTTPS）
- App 进程：systemd
- 数据层：PostgreSQL + Redis（Docker Compose）
- 目录约定：
  - `/opt/store/releases/<release-id>`
  - `/opt/store/current`（symlink）
  - `/opt/store/shared/backend.env`
  - `/opt/store/shared/storefront.env`
  - `/opt/store/shared/services.env`
  - `/opt/store/shared/pnpm-store`

仓库已提供：

- `scripts/deploy/bootstrap-vps.sh`
- `scripts/deploy/install-systemd.sh`
- `scripts/deploy/deploy.sh`
- `scripts/deploy/rollback.sh`
- `scripts/deploy/health-gate.sh`
- `ops/systemd/*.service.tpl`
- `ops/caddy/Caddyfile.production.example`
- `.github/workflows/deploy.yml`

## 3. 首次上线（一次性）

### 3.1 服务器准备

安装运行依赖：

- Node.js 22+
- pnpm 10+
- Docker + Docker Compose
- git / curl / jq

发布用户（例如 `store`）需要具备 `sudo systemctl` 权限，否则发布脚本无法重启服务。

示例 sudoers（用 `visudo` 配置）：

```text
store ALL=(root) NOPASSWD: /bin/systemctl, /usr/bin/systemctl
```

克隆仓库到服务器，例如：

```bash
sudo mkdir -p /opt/store/repo
sudo chown -R $USER:$USER /opt/store/repo
git clone <your-repo-url> /opt/store/repo
cd /opt/store/repo
```

### 3.2 初始化部署目录与 env

```bash
sudo APP_ROOT=/opt/store APP_USER=store bash scripts/deploy/bootstrap-vps.sh
```

然后编辑：

- `/opt/store/shared/backend.env`
- `/opt/store/shared/storefront.env`
- `/opt/store/shared/services.env`

务必替换所有密钥、域名、数据库密码。

若启用 Resend 邮件发送，还需要在 `backend.env` 设置：

- `RESEND_ENABLED=true`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- 可选 `RESEND_REPLY_TO_EMAIL`

若进行加密密钥轮换，迁移窗口内还应设置：

- 可选 `CREDENTIAL_ENCRYPTION_KEY_PREVIOUS`（逗号分隔）
- 可选 `DELIVERY_ENCRYPTION_KEY_PREVIOUS`（逗号分隔）

### 3.3 安装 systemd 服务

```bash
cd /opt/store/repo
sudo APP_ROOT=/opt/store APP_USER=store bash scripts/deploy/install-systemd.sh
```

### 3.4 启动 DB/Redis

```bash
cd /opt/store/repo
APP_ROOT=/opt/store pnpm services:up:prod
```

### 3.5 配置 Caddy

使用模板：`ops/caddy/Caddyfile.production.example`

至少配置：

- `STOREFRONT_DOMAIN`
- `API_DOMAIN`

并确认：

- `example.com -> 127.0.0.1:8000`
- `api.example.com -> 127.0.0.1:9002`

### 3.5.1 Cloudflare（可选但推荐）

若站点前置 Cloudflare，建议：

- DNS 记录走 Proxied（橙云）；
- SSL/TLS mode 使用 `Full (strict)`；
- 不使用 `Flexible`（会导致 Cloudflare 到源站链路非严格加密）；
- 仍在源站保留有效 HTTPS（Cloudflare Origin CA 或公网受信证书）。

可选 API 校验（部署后）：

```bash
STOREFRONT_PUBLIC_URL=https://example.com \
API_PUBLIC_URL=https://api.example.com \
EXPECT_CLOUDFLARE=true \
REQUIRE_CLOUDFLARE_SSL_MODE=strict \
CLOUDFLARE_ZONE_ID=<zone-id> \
CLOUDFLARE_API_TOKEN=<token-with-zone-settings-read> \
  bash scripts/deploy/edge-preflight.sh
```

### 3.6 首次发布

```bash
cd /opt/store/repo
APP_ROOT=/opt/store bash scripts/deploy/deploy.sh --ref main
```

发布脚本会执行：

- 获取指定 commit
- 创建 release 目录
- 安装依赖、构建 backend/storefront
- 执行数据库迁移
- 切换 `current` symlink
- 重启 systemd
- 健康检查
- 失败自动回滚到上一版

## 4. 日常发布链路（推荐）

### 4.1 本地到线上的完整链条

1. 本地开发、提交、push 到 GitHub。
2. 在 GitHub Actions 触发 `Deploy` workflow。
3. Workflow 通过 SSH 登录服务器。
4. 服务器 `git fetch` + `checkout` 指定 ref。
5. 执行 `scripts/deploy/deploy.sh`。
6. 发布成功后输出 `release_id`。

### 4.2 GitHub Actions 需要的 Secrets

- `DEPLOY_HOST`
- `DEPLOY_SSH_USER`
- `DEPLOY_SSH_PRIVATE_KEY`
- `DEPLOY_HOST_KEY`
- `DEPLOY_REPO_PATH`（如 `/opt/store/repo`）
- `APP_ROOT`（可选，默认 `/opt/store`）

### 4.3 一键回滚

同一个 workflow 选择 `operation=rollback` 即可，支持：

- 回滚到上一版
- 指定 `rollback_to` 精确回滚

## 5. 数据库迁移策略

- 迁移默认在部署时执行（`RUN_DB_MIGRATIONS=true`）。
- 生产要求迁移向后兼容（expand/contract），避免立刻删除旧字段。
- 每次生产迁移前执行备份：

```bash
pnpm backup:db
```

- 大版本变更先在预发做完整回归（尤其 webhook/claim/recover）。

## 6. 关键流程回归（webhook / claim / recover）

仓库已提供回归脚本：

```bash
BACKEND_URL=http://127.0.0.1:9002 \
STOREFRONT_URL=http://127.0.0.1:8000 \
BACKEND_ENV_FILE=/opt/store/shared/backend.env \
  bash scripts/deploy/regression-webhook-claim-recover.sh
```

它会覆盖：

- manual webhook 签名验证路径
- claim 并发保护
- recover 发码与验码主流程

## 7. manual webhook 调用方规范

调用方必须发送：

- `x-manual-webhook-timestamp`
- `x-manual-webhook-signature`

仓库提供了可直接复用的签名发送脚本：

```bash
MANUAL_WEBHOOK_SECRET=... \
scripts/deploy/send-manual-webhook.sh --provider-order-id <id> --status paid
```

## 8. 是否需要灰度/金丝雀

当前阶段结论：

- 不是强制项，但需要“可启用能力”。
- 当前优先级是“可回滚 + 预发全链路回归 + 生产健康门禁”。

建议启用金丝雀的触发条件：

- 高频发布（每天多次）
- 流量明显增长
- 需要更高发布安全性

当前仓库的可落地路径：

- 先维持单 stable 实例（已具备）。
- 通过 Caddy header 路由预留 canary（模板已留注释）。
- 后续新增 canary systemd 单元和端口，再按 header/cookie 分流。

## 9. 安全与运维基线

- 永远不要使用默认弱密钥。
- `backend.env`/`storefront.env` 权限保持最小（640）。
- `services.env` 权限保持最小（640）。
- Postgres/Redis 仅监听内网，不暴露公网。
- 生产环境建议启用 `SECURITY_TRUST_PROXY_HEADERS=true`、`SECURITY_ENFORCE_ORIGIN_CHECKS=true`、`SECURITY_HEADERS_ENABLED=true`。
- 若已全站 HTTPS，建议设置 `SECURITY_HSTS_MAX_AGE_SECONDS=31536000` 并评估 `includeSubDomains` / `preload`。
- 强制 HTTPS。
- 每日备份 + 异机备份 + 定期恢复演练。
- 至少保留最近 8 个 release，确保快速回滚。

## 10. 常用命令

部署：

```bash
APP_ROOT=/opt/store bash scripts/deploy/deploy.sh --ref main
```

启动数据层：

```bash
APP_ROOT=/opt/store pnpm services:up:prod
```

回滚：

```bash
APP_ROOT=/opt/store bash scripts/deploy/rollback.sh
```

健康门禁：

```bash
BACKEND_HEALTH_URL=http://127.0.0.1:9002/health \
STOREFRONT_HEALTH_URL=http://127.0.0.1:8000/api/health \
  bash scripts/deploy/health-gate.sh
```

公网 HTTPS / Edge 校验：

```bash
STOREFRONT_PUBLIC_URL=https://example.com \
API_PUBLIC_URL=https://api.example.com \
EXPECT_CLOUDFLARE=false \
  bash scripts/deploy/edge-preflight.sh
```

回归：

```bash
bash scripts/deploy/regression-webhook-claim-recover.sh
```
