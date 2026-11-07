#!/bin/bash

set -e
pnpm install
echo 'DATABASE_URL="file:./dev.db"' > .env
pnpm prisma migrate deploy
pnpm prisma generate
pnpm dlx tsx prisma/seed.ts
pnpm run dev
