#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f .env ] || grep -q "file:./dev.db" .env; then
  cat << 'EOF' > .env
DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public"
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=db
PORT=3000
NODE_ENV=development
EOF
fi

docker compose up -d --wait

pnpm install

pnpm prisma generate
pnpm prisma db push --force-reset
pnpm dlx tsx prisma/seed.ts

pnpm run dev
