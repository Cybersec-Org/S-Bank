#!/usr/bin/env bash
set -e
<<<<<<< HEAD
<<<<<<< HEAD
cd "$(dirname "$0")"

# .env holds DATABASE_URL (postgresql://...) and POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB for docker-compose.
# Create it from the template file in this folder; this script never overwrites it.
if [ ! -f .env ]; then
  echo "Missing api/.env. Create it from CREATE_FILE_.env_AND_COPY_PASTE_IT, then run this script again." >&2
  exit 1
fi

pnpm install
# Postgres must be running first, e.g.: docker compose up -d postgres
pnpm prisma migrate deploy
=======

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

>>>>>>> origin/passkeys-and-stepup
=======

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

>>>>>>> origin/passkeys-and-stepup
pnpm prisma generate
pnpm prisma db push --force-reset
pnpm dlx tsx prisma/seed.ts

pnpm run dev
