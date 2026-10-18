# syntax=docker/dockerfile:1
# S-Bank API image. The build context is the repository root:
#   docker build -f api/Dockerfile --target runtime -t sbank-api .
#   docker build -f api/Dockerfile --target migrate -t sbank-api-migrate .
# Targets: runtime (default, the API) and migrate (one-off `prisma migrate deploy` job in Compose).
# No secrets are built into any layer: configuration arrives as environment variables at run time.

# --- base: Node.js plus the pnpm version pinned in the root package.json -------------------------
FROM node:26.11.1-alpine3.24@sha256:143494b1da2945f061539253adc65e4f1569ddf07da2d384c022c791a9d90a4a AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1
WORKDIR /repo
COPY package.json ./
RUN corepack enable

# --- deps: workspace manifests only, so this layer is reused until a dependency changes ----------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY api/package.json api/package.json
COPY app/package.json app/package.json
RUN pnpm install --frozen-lockfile --filter @sbank/api

# --- build: generate the Prisma client, compile, and assemble the deployable packages ------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY api/ api/
RUN pnpm --filter @sbank/api run build
# `files` in api/package.json (dist) decides what is copied; --prod leaves out dev dependencies.
RUN pnpm --filter=@sbank/api --prod deploy /deploy/runtime
# Same, with dev dependencies, because the prisma CLI is a dev dependency.
RUN pnpm --filter=@sbank/api deploy /deploy/migrate

# --- migrate: one-off job that applies migrations (and seeds in development) ---------------------
FROM node:26.11.1-alpine3.24@sha256:143494b1da2945f061539253adc65e4f1569ddf07da2d384c022c791a9d90a4a AS migrate
# The Prisma schema engine links against OpenSSL, which the Alpine Node image does not ship.
# npm, corepack and yarn ship with the base image but nothing here runs them; they only add
# vulnerable bundled packages (tar, undici, ...) and a package installer to a container.
RUN apk add --no-cache openssl \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
       /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1
WORKDIR /app
COPY --from=build --chown=node:node /deploy/migrate/ ./
COPY --from=build --chown=node:node /repo/api/prisma7.config.ts ./
COPY --from=build --chown=node:node /repo/api/prisma ./prisma
# prisma7.config.ts imports the shared dotenv loader; seeds import the generated client.
COPY --from=build --chown=node:node /repo/api/src/config/root-env-file.ts ./src/config/root-env-file.ts
COPY --from=build --chown=node:node /repo/api/src/generated ./src/generated
USER node
HEALTHCHECK NONE
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

# --- runtime: the API itself ----------------------------------------------------------------------
FROM node:26.11.1-alpine3.24@sha256:143494b1da2945f061539253adc65e4f1569ddf07da2d384c022c791a9d90a4a AS runtime
# Same reason as in the migrate stage: only `node` is run in this image.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production \
    API_PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /deploy/runtime/ ./
USER node
EXPOSE 3000
# busybox wget exits non-zero on any non-2xx answer; /health also checks the database.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget --quiet --output-document=/dev/null "http://127.0.0.1:${API_PORT}/health" || exit 1
CMD ["node", "dist/main.js"]
