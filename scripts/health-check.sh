#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:9002}"
STOREFRONT_URL="${STOREFRONT_URL:-http://localhost:8000}"

curl -fsS "$BACKEND_URL/health" >/dev/null
curl -fsS "$STOREFRONT_URL/api/health" >/dev/null

docker compose ps postgres redis

echo "health-check: ok"
