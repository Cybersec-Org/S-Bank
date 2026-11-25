#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$REPO_ROOT/.env" ]; then
  echo "Missing repository .env; configure it before starting Docker Compose." >&2
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "Missing api/.env; configure DATABASE_URL before running Prisma." >&2
  exit 1
fi

docker compose --env-file "$REPO_ROOT/.env" -f "$REPO_ROOT/docker-compose.yml" up -d --wait postgres keycloak

cd "$SCRIPT_DIR"
pnpm install
pnpm prisma generate
pnpm prisma migrate deploy
pnpm dlx tsx prisma/seed.ts
pnpm run dev
