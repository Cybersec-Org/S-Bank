# Phase 4 — infra blueprint (Docker Compose)

All image tags exact (confirm current stable versions with `docs-researcher`): PostgreSQL 18 (alpine), Keycloak 26.x, Caddy 2.x, Mailpit 1.x, Node LTS alpine for builds.

## `infra/docker-compose.yml`

Project name `sbank`. Networks: `edge` (bridge) and `internal` (`internal: true`). Volumes: `app-db-data`, `kc-db-data`, `caddy-data`, `caddy-config`, `softhsm-tokens` (B-28).

| Service    | Image / build                                   | Networks        | Notes                                                                                                                                                                                                                                                                                                                                      |
| ---------- | ----------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app-db`   | postgres 18                                     | internal        | `POSTGRES_PASSWORD` from env; init SQL in `infra/postgres/init/` creates `sbank_migrator` (DDL) and `sbank_app` (DML only, no audit UPDATE/DELETE); healthcheck `pg_isready`; dev port `127.0.0.1:5432:5432` behind profile `dev-ports`                                                                                                    |
| `kc-db`    | postgres 18                                     | internal        | separate database for Keycloak; no published port                                                                                                                                                                                                                                                                                          |
| `keycloak` | quay.io/keycloak/keycloak 26.x                  | internal        | `start-dev --import-realm` locally (comment: production uses `start` with a built image); `KC_DB=postgres`; `KC_HTTP_RELATIVE_PATH=/auth`; `KC_PROXY_HEADERS=xforwarded`; `KC_HOSTNAME=https://${SBANK_DOMAIN}/auth`; `KC_HEALTH_ENABLED=true`; bootstrap admin from env; realm file mounted read-only; healthcheck on the management port |
| `mailpit`  | axllent/mailpit 1.x                             | internal        | SMTP for Keycloak; UI only on `127.0.0.1:8025` (profile `dev-ports`)                                                                                                                                                                                                                                                                       |
| `migrate`  | build `api/Dockerfile` (target with prisma CLI) | internal        | one-off `prisma migrate deploy` as `sbank_migrator`; `depends_on: app-db: service_healthy`; `restart: "no"`                                                                                                                                                                                                                                |
| `api`      | build `api/Dockerfile`                          | internal        | `DATABASE_URL` with `sbank_app`; `TRUST_PROXY=true`; `depends_on: migrate: service_completed_successfully`, `keycloak: service_healthy`; healthcheck `/health`; read-only root fs, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`                                                                                             |
| `web`      | build `app/Dockerfile`                          | internal        | static web export; healthcheck; read-only, non-root                                                                                                                                                                                                                                                                                        |
| `caddy`    | caddy 2.x                                       | edge + internal | ports `80:80`, `443:443`; Caddyfile mounted read-only; `depends_on` api/keycloak/web healthy                                                                                                                                                                                                                                               |

Apply `read_only`, `cap_drop: [ALL]`, `no-new-privileges` wherever the image supports it (Postgres and Keycloak need writable data dirs — use volumes and `tmpfs`).

## `infra/caddy/Caddyfile`

```
{$SBANK_DOMAIN:localhost} {
  # local CA for development; a real public domain drops this line and uses ACME
  tls internal
  encode zstd gzip
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "no-referrer"
    Permissions-Policy "camera=(), geolocation=(), microphone=()"
    Cross-Origin-Opener-Policy "same-origin"
    -Server
  }
  request_body { max_size 1MB }

  handle /auth/admin* { respond 404 }
  handle /auth/* { reverse_proxy keycloak:8080 }
  handle /api/* { reverse_proxy api:3000 }
  handle /public/* { reverse_proxy api:3000 }
  handle /partner/* {
    # B-26: client_auth with the S-Bank CA; until then the zone is closed
    respond 403
  }
  handle {
    header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    reverse_proxy web:8080
  }
}
```

Adjust only what the current Caddy docs require; keep the security headers. If Expo's web output needs `'unsafe-inline'` scripts, prefer a hash/nonce and record any relaxation in an ADR.

## `infra/keycloak/realm-sbank.json` (minimal realm as code — B-07 completes it)

- Realm `sbank`, `sslRequired: external`, `registrationAllowed: true`, `verifyEmail: true`, `loginWithEmailAllowed: true`, `bruteForceProtected: true` (`failureFactor: 10`, wait increments), `passwordPolicy: "length(12) and notUsername"`, `accessTokenLifespan: 300`, `revokeRefreshToken: true`, `refreshTokenMaxReuse: 0`, SMTP → `mailpit:1025`.
- Realm roles: `customer` (default role for new users), `employee`, `admin`.
- Client `sbank-app`: public, standard flow only, `pkce.code.challenge.method: S256`, exact `redirectUris` (`https://localhost/oauth/callback`, `http://localhost:8081/oauth/callback`; no custom `sbank://` scheme: another app can claim it, so the native return is a verified HTTPS App/Universal Link added in B-10), exact `webOrigins`, implicit/direct-grant/service-accounts off, audience mapper adding `sbank-api`.
- Client `sbank-api`: bearer-only/resource (no flows).
- No users with passwords in the export. Document in `infra/keycloak/README.md` how to export changes (`kc.sh export --realm sbank --users skip`).

## `app/Dockerfile`

Build stage: workspace install, `pnpm run app:export:web` with `EXPO_PUBLIC_*` build args (non-secret). Runtime: unprivileged static server on port 8080 (e.g. `caddy` with a tiny `file_server` + SPA fallback, or `nginxinc/nginx-unprivileged`), `HEALTHCHECK`, non-root.

## `infra/README.md` (Polish)

Services and ports, how to start (`node scripts/dev-secrets.mjs`, `pnpm run infra:up`), trusting Caddy's local CA, where Mailpit and Keycloak admin are reachable (localhost-only), how to reset volumes.

## Checks

`docker compose --env-file .env -f infra/docker-compose.yml config --quiet` (never without `--quiet` — it prints secrets), `pnpm run infra:up`, `docker compose … ps` shows all services healthy, `curl -k https://localhost/` returns the web app, `curl -k https://localhost/api/me` returns 401 problem JSON.
