FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@12.9.1 --activate

# Workspace manifests and lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json ./api/package.json
COPY app/package.json ./app/package.json

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy application source
COPY . .

# Generate Prisma Client and build API
RUN pnpm --filter @sbank/api exec prisma generate
RUN pnpm --filter @sbank/api build

WORKDIR /workspace/api

ENV PORT=3000

EXPOSE 3000

RUN chown -R node:node /workspace
USER node

CMD ["node", "dist/src/main.js"]
