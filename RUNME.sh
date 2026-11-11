#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

MODE="${1:-dev}"

corepack enable 2>/dev/null || true
if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile || pnpm install
else
  (cd api && pnpm install)
  (cd app && pnpm install)
fi

if [ -f scripts/dev-secrets.mjs ]; then
  node scripts/dev-secrets.mjs
fi

if [ ! -f api/.env ] || grep -q "file:./dev.db" api/.env; then
  cat << 'EOF' > api/.env
DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public"
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=db
PORT=3000
NODE_ENV=development
EOF
fi

if [ "$MODE" = "infra" ]; then
  pnpm run infra:up
  exit 0
fi

if [ -f api/docker-compose.yaml ]; then
  (cd api && docker compose up -d --wait)
fi

(
  cd api
  pnpm prisma generate
  pnpm prisma db push --force-reset
  if [ -f prisma/seed.ts ]; then
    pnpm dlx tsx prisma/seed.ts
  fi
)

cleanup() {
  echo ""
  echo "==> Stop, bye ;P"
  if [ -n "${API_PID:-}" ]; then
    kill "$API_PID" 2>/dev/null || true
  fi
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

(cd api && pnpm run dev) &
API_PID=$!

sleep 3

export EXPO_PUBLIC_API_MODE="${EXPO_PUBLIC_API_MODE:-mock}"
export EXPO_PUBLIC_API_MODE="$API_MODE"

if grep -q '"app:start"' package.json 2>/dev/null; then
  pnpm run app:start
else
  cd app && pnpm start
fi
