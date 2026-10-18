# syntax=docker/dockerfile:1
# S-Bank web image: the Expo web export served by an unprivileged static server. The build context is
# the repository root:
#   docker build -f app/Dockerfile -t sbank-web .
# Only non-secret EXPO_PUBLIC_* values are build arguments; they end up in the public JavaScript bundle.
# EXPO_PUBLIC_API_MODE defaults to `mock` on purpose: a production bundle without it would run `live`
# and show no demo data while the backend is still being built.

# Image references are literal (tag plus digest of the multi-architecture index) so that Dependabot's
# docker ecosystem can update them.

# --- base: Node.js plus the pnpm version pinned in the root package.json -------------------------
FROM node:26.11.1-alpine3.24@sha256:143494b1da2945f061539253adc65e4f1569ddf07da2d384c022c791a9d90a4a AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    EXPO_NO_TELEMETRY=1 \
    CI=1
WORKDIR /repo
COPY package.json ./
RUN corepack enable

# --- deps: workspace manifests only, so this layer is reused until a dependency changes ----------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY api/package.json api/package.json
COPY app/package.json app/package.json
RUN pnpm install --frozen-lockfile --filter @sbank/app

# --- build: the static web export in app/dist ------------------------------------------------------
FROM deps AS build
ARG EXPO_PUBLIC_API_MODE=mock
ARG EXPO_PUBLIC_API_BASE_URL=https://localhost
ARG EXPO_PUBLIC_OIDC_ISSUER_URL=https://localhost/auth/realms/sbank
ARG EXPO_PUBLIC_OIDC_CLIENT_ID=sbank-app
ENV EXPO_PUBLIC_API_MODE=${EXPO_PUBLIC_API_MODE} \
    EXPO_PUBLIC_API_BASE_URL=${EXPO_PUBLIC_API_BASE_URL} \
    EXPO_PUBLIC_OIDC_ISSUER_URL=${EXPO_PUBLIC_OIDC_ISSUER_URL} \
    EXPO_PUBLIC_OIDC_CLIENT_ID=${EXPO_PUBLIC_OIDC_CLIENT_ID}
COPY tsconfig.base.json ./
COPY app/ app/
RUN pnpm --filter @sbank/app run export:web

# --- runtime: Caddy as a plain static file server on 8080, no root, no capabilities --------------
FROM caddy:2.11.7-alpine@sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f AS runtime
# The official image gives /usr/bin/caddy the file capability cap_net_bind_service. With every
# capability dropped (cap_drop: ALL) the kernel then refuses to execute the binary at all, and this
# server listens on 8080 and needs no capability, so the file capability is removed.
RUN setcap -r /usr/bin/caddy
# Single-page app: unknown paths fall back to index.html (routing happens in the client). No TLS and
# no admin API here; the edge Caddy terminates TLS and sets the security headers.
COPY --chmod=0644 <<'EOF' /etc/caddy/Caddyfile
{
	admin off
	auto_https off
	persist_config off
}

:8080 {
	root * /srv

	# Content-hashed bundle files that exist can be cached for good; everything else, including the
	# index.html fallback, is always revalidated.
	@hashed {
		path /_expo/static/*
		file
	}
	handle @hashed {
		header Cache-Control "public, max-age=31536000, immutable"
		file_server
	}
	handle {
		header Cache-Control "no-cache"
		try_files {path} /index.html
		file_server
	}
}
EOF
COPY --from=build --chown=0:0 /repo/app/dist/ /srv/
# Caddy wants writable XDG directories even when it persists nothing; the compose file mounts a tmpfs on /tmp.
ENV XDG_CONFIG_HOME=/tmp/caddy/config \
    XDG_DATA_HOME=/tmp/caddy/data
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget --quiet --output-document=/dev/null http://127.0.0.1:8080/index.html || exit 1
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
