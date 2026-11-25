#!/bin/bash

set -e
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
pnpm prisma generate
pnpm dlx tsx prisma/seed.ts
pnpm run dev
