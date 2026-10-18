# CI contract

`.github/workflows/ci.yml`, `security.yml` and `dast.yml` depend on everything below. If you must change a name, change the workflow in the same step and say so in the hand-over.

## Workspace

- Root `package.json` has `"packageManager": "pnpm@<exact version>"` (read by `pnpm/action-setup`) and `"engines": { "node": ">=<LTS major>" }`.
- `.nvmrc` holds the Node.js LTS major (read by `actions/setup-node`).
- Workspace package names: `@sbank/app` (directory `app`) and `@sbank/api` (directory `api`).
- `pnpm install --frozen-lockfile` works on a clean checkout. Packages that need install scripts (Prisma engines are gone in 7, but `@swc/core`, `esbuild`, `sharp` etc. may still need them) are listed in the workspace build-script allowlist.

## Root scripts

| Script                  | Must do                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format:check`          | `prettier --check .`                                                                                                                                                                            |
| `format`                | `prettier --write .`                                                                                                                                                                            |
| `lint`                  | `pnpm -r lint` — ESLint, zero warnings (`--max-warnings 0`)                                                                                                                                     |
| `typecheck`             | `pnpm -r typecheck` — `tsc --noEmit` per package                                                                                                                                                |
| `test`                  | `pnpm -r test` — unit/component tests, no database, no network                                                                                                                                  |
| `build`                 | `pnpm -r build` — api: compile to `api/dist`; app: `expo export --platform web --output-dir dist`                                                                                               |
| `app:start`             | `pnpm --filter @sbank/app start`                                                                                                                                                                |
| `app:export:web`        | web bundle into `app/dist`                                                                                                                                                                      |
| `app:export:native`     | `expo export --platform android --platform ios --output-dir dist-native` (JS bundles compile check)                                                                                             |
| `app:doctor`            | `expo-doctor` (installed as a pinned devDependency of `@sbank/app`)                                                                                                                             |
| `app:build:android`     | `expo prebuild --platform android --clean` then `./gradlew assembleDebug --no-daemon` in `app/android` (CI job `native-android`; needs JDK and Android SDK)                                     |
| `app:api:types`         | `openapi-typescript ../api/openapi.json -o src/shared/api/schema.d.ts` followed by Prettier on that file                                                                                        |
| `api:dev`               | Nest in watch mode, loads root `.env`                                                                                                                                                           |
| `api:test:e2e`          | supertest e2e tests against `DATABASE_URL` (migrations already applied)                                                                                                                         |
| `api:openapi:generate`  | writes `api/openapi.json` **without** a database or network (build the Nest app with Prisma mocked or not connected; `SwaggerModule.createDocument`), formatted with Prettier, stable key order |
| `api:prisma:generate`   | `prisma generate`                                                                                                                                                                               |
| `api:prisma:validate`   | `prisma validate`                                                                                                                                                                               |
| `api:db:migrate:dev`    | `prisma migrate dev` (local only; extra options pass through: `pnpm run api:db:migrate:dev --name x --create-only`)                                                                             |
| `api:db:migrate:deploy` | `prisma migrate deploy`                                                                                                                                                                         |
| `api:db:check-drift`    | exits non-zero when `schema.prisma` and `prisma/migrations` disagree (`prisma migrate diff` from migrations to schema with `--exit-code`, using the Prisma 7 flags)                             |
| `api:db:seed`           | `prisma db seed`                                                                                                                                                                                |
| `api:db:reset`          | `prisma migrate reset` (local only, asks permission)                                                                                                                                            |
| `infra:up`              | `docker compose --env-file .env -f infra/docker-compose.yml up -d --wait`                                                                                                                       |
| `infra:down`            | `docker compose --env-file .env -f infra/docker-compose.yml down`                                                                                                                               |
| `infra:logs`            | `docker compose --env-file .env -f infra/docker-compose.yml logs -f --tail=200`                                                                                                                 |

`api:prisma:generate` must also run automatically before `typecheck`, `test`, `build` and `api:openapi:generate` of `@sbank/api` (e.g. as a `pre*` script or inside the script), because the generated client is git-ignored.

Migrations must also apply on a single-role database: CI's Postgres service has only the owner role `sbank`, so `GRANT`/`REVOKE` statements for `sbank_app`/`sbank_migrator` are wrapped in `DO $$ … IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sbank_app') … $$`. Triggers and `CHECK` constraints are unconditional, so the audit-log immutability test passes in CI too.

CI checks the contract drift with: `pnpm run api:openapi:generate && pnpm run app:api:types && git diff --exit-code -- api/openapi.json app/src/shared/api/schema.d.ts`.

## Environment variables

API (validated by zod in `api/src/config/env.schema.ts`; CI sets these):

| Variable                     | CI value                              | Notes                                                             |
| ---------------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| `NODE_ENV`                   | `test`                                | `development` / `test` / `production`                             |
| `API_PORT`                   | `3000`                                |                                                                   |
| `DATABASE_URL`               | Postgres service URL                  | app role, least privilege in compose                              |
| `CORS_ORIGINS`               | `http://localhost:8081`               | comma-separated allowlist                                         |
| `OIDC_ISSUER_URL`            | `https://localhost/auth/realms/sbank` |                                                                   |
| `OIDC_AUDIENCE`              | `sbank-api`                           |                                                                   |
| `OIDC_JWKS_URL`              | _(empty)_                             | optional; defaults to issuer discovery; tests inject a local JWKS |
| `LOG_LEVEL`                  | `warn`                                |                                                                   |
| `STEP_UP_THRESHOLD_GROSZE`   | `100000`                              | default if unset                                                  |
| `DEFAULT_DAILY_LIMIT_GROSZE` | `500000`                              | default if unset                                                  |
| `NBP_API_BASE_URL`           | `https://api.nbp.pl/api`              | fixed default; only override in tests                             |
| `TRUST_PROXY`                | `false`                               | `true` behind Caddy in compose                                    |

App (`EXPO_PUBLIC_*`, validated in `app/src/shared/config/env.ts`):

| Variable                      | CI value                              |
| ----------------------------- | ------------------------------------- |
| `EXPO_PUBLIC_API_MODE`        | `mock` (`mock` / `live`)              |
| `EXPO_PUBLIC_API_BASE_URL`    | `https://localhost`                   |
| `EXPO_PUBLIC_OIDC_ISSUER_URL` | `https://localhost/auth/realms/sbank` |
| `EXPO_PUBLIC_OIDC_CLIENT_ID`  | `sbank-app`                           |

Compose-only variables (in `.env.example`): `POSTGRES_PASSWORD`, `POSTGRES_APP_PASSWORD`, `KC_DB_PASSWORD`, `KC_BOOTSTRAP_ADMIN_PASSWORD` (all `__GENERATE__`), `SBANK_DOMAIN=localhost`.

## Containers

- `api/Dockerfile` and `app/Dockerfile` build with the **repository root** as context (`docker build -f api/Dockerfile .`). Both run as non-root and define `HEALTHCHECK`.
- `infra/docker-compose.yml` works with `docker compose --env-file .env -f infra/docker-compose.yml up -d --build --wait` on a fresh runner after `node scripts/dev-secrets.mjs`; every service is healthy afterwards.
- Caddy serves `https://localhost` with `tls internal`: `/` → web app container, `/api/*` `/public/*` `/partner/*` → API, `/auth/*` → Keycloak. `/health` and the Keycloak admin console are not routed.
- The DAST workflow scans `https://localhost/` and `https://localhost/public/rates` (B-15 adds the route; 404 before that is acceptable).
