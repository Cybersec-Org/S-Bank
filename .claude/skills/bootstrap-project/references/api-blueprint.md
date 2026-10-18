# Phase 3 — API blueprint (NestJS + Prisma 7)

## Create

1. `pnpm dlx @nestjs/cli new api --package-manager pnpm --strict --skip-git` (confirm flags with `docs-researcher`). Keep the ESM setup new projects get by default; relative imports end with `.js`.
2. Remove the example controller/service/spec. Set `name: "@sbank/api"`, scripts: `dev`, `build`, `start:prod`, `lint`, `typecheck`, `test`, `test:e2e`, `openapi:generate`, `prisma:*`, `db:*` (see contract).
3. Dependencies: `@nestjs/config`, `@nestjs/swagger`, `@nestjs/throttler`, `@nestjs/terminus`, `nestjs-pino`, `pino-http`, `helmet`, `class-validator`, `class-transformer`, `jose`, `@casl/ability`, `zod`, `dotenv`, `prisma@7` (dev), `@prisma/client@7`, `@prisma/adapter-pg@7`, `pg`. Dev: `supertest`, `@types/supertest`, `tsx` (seed/scripts), `eslint-plugin-security`. Use the SWC builder only if the CLI offers it by default.

## Bootstrap (`main.ts`)

- `NestFactory.create(AppModule, { bufferLogs: true })`, `app.useLogger(app.get(Logger))` (pino).
- `app.use(helmet())` with API-appropriate CSP (`default-src 'none'`, `frame-ancestors 'none'`).
- `app.enableCors({ origin: allowlist from CORS_ORIGINS, credentials: false })`.
- Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: false } })`.
- Global `ProblemDetailsFilter` (RFC 9457, `application/problem+json`, no stack, `traceId` = request id).
- `app.set('trust proxy', …)` only when `TRUST_PROXY=true`.
- `app.enableShutdownHooks()`.
- Swagger UI at `/public/docs` only when `NODE_ENV !== 'production'`; document built with `DocumentBuilder` (title S-Bank API, bearer auth scheme, servers `/`).
- Body size limit (e.g. `100kb`).

## Modules

- `ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env'], validate: (env) => envSchema.parse(env) })` — zod schema from `ci-contract.md`, typed `AppConfigService`.
- `LoggerModule.forRoot` (nestjs-pino): `redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', '*.accessToken', '*.refreshToken', '*.password', '*.iban', '*.balanceGrosze']`, request id from `x-request-id` or `randomUUID()`.
- `ThrottlerModule` with named profiles: `default` (e.g. 100/min), `public` (30/min), `auth` (10/min), `transfers` (10/min). Apply the guard globally.
- `PrismaModule` (global) with `PrismaService extends PrismaClient` using `PrismaPg` adapter, `onModuleInit` `$connect`, `onModuleDestroy` `$disconnect` — follow the current NestJS Prisma recipe.
- `SecurityModule`:
  - `TokenVerifier` interface `{ verify(token): Promise<Principal> }`. Implementation for now: `FailClosedTokenVerifier` that always throws `UnauthorizedException` — comment `// B-11: replace with JoseTokenVerifier (JWKS, algorithms: ['RS256','PS256','ES256'], issuer, audience, clockTolerance ≤ 5s)`. Test helpers provide a `TestTokenVerifier` backed by a local JWKS so e2e tests can exercise roles now.
  - `AuthGuard` (global, `APP_GUARD`): reads `@Public()` metadata via `Reflector`; otherwise requires `Authorization: Bearer`, calls the verifier, attaches `principal` to the request, checks `@Roles()`; handlers without `@Roles()` and without `@Public()` are rejected with 403 and a log warning ("route without access declaration").
  - `@RequireStepUp({ maxAgeSeconds })` checks `principal.acr === '2'` and `auth_time` freshness → 403 problem `step-up-required`.
  - `AbilityFactory.createFor(principal)` with CASL: customer `read Account { ownerId }`, employee `read Account`, `update Account.limit/status`, admin `read AuditLog`, partner `create/read PaymentRequest { partnerId }`; everything else denied. Unit tests for each role.
- `AuditModule`: `AuditService.record({ actorId, actorRole, action, resourceType, resourceId, ip, acr, metadata })` — writes only through Prisma `create`; accepts a transaction client.
- `HealthModule`: `GET /health` (`@Public()`, `@SkipThrottle()`), Terminus Prisma ping. Not routed by Caddy.
- `MeModule`: `GET /api/me` with `@Roles('customer','employee','admin')` returning `{ subject, roles, acr }` — the first protected route; proves deny-by-default end to end.

## Prisma

- `prisma init` for 7.x with `--output ../src/generated/prisma` (or equivalent), datasource `postgresql`, the config file loads the root `.env` explicitly.
- Initial schema (`init_core` migration):
  - `Customer` (`id` uuid, `subject` unique — Keycloak `sub`, `displayName`, timestamps)
  - `Account` (`id`, `ownerId` → Customer, `iban` unique, `currency` default `PLN`, `balanceGrosze` BigInt, `dailyLimitGrosze` BigInt default 500000, `status` enum `ACTIVE|BLOCKED`, timestamps; index on `ownerId`)
  - `Transaction` (`id`, `accountId`, `direction` enum `DEBIT|CREDIT`, `amountGrosze` BigInt, `counterpartyIban`, `counterpartyName`, `title`, `bookedAt`; index `(accountId, bookedAt desc)`)
  - `AuditLog` (`id`, `occurredAt`, `actorId`, `actorRole`, `action`, `resourceType`, `resourceId`, `ip`, `acr`, `metadata` Json)
- Create the migration with `--create-only`, then append SQL: `CHECK (balance_grosze >= 0)`, `CHECK (amount_grosze > 0)`, `CHECK (daily_limit_grosze BETWEEN 0 AND 5000000)`, audit-log protection (revoke `UPDATE, DELETE, TRUNCATE` from the app role created by `infra/postgres` init SQL — wrapped in a `DO` block that checks `pg_roles`, because CI has a single role; trigger raising an exception on `UPDATE`/`DELETE`, unconditional). Then apply.
- `seed.ts`: two demo customers (`Anna Testowa`, `Jan Przykładowy`), one account each with a demo balance and a few transactions; idempotent (upserts by `subject`/`iban`). IBANs valid PL format, clearly fake.
- Recipients, transfer drafts, idempotency keys, payment requests and partners are added by their backlog items through the `db-migration` skill — not now.

## OpenAPI generation (`scripts/generate-openapi.ts`)

Create the Nest app with the Prisma provider overridden by a no-op (no DB connection), build the Swagger document, sort keys, write `openapi.json`. `pnpm run api:openapi:generate` must work offline.

## Tests

- Unit: `AuthGuard` (public, missing token, wrong role, no declaration), `RequireStepUp`, `AbilityFactory` per role, config schema, problem-details filter.
- E2E (`test/`): `GET /health` 200; `GET /api/me` → 401 without token, 401 with any token under `FailClosedTokenVerifier`, 200 with `TestTokenVerifier` for each role; unknown route → 404 problem; `forbidNonWhitelisted` rejects extra fields (use a tiny test-only controller registered in the test module).
- `test/authz/matrix.ts` with the first rows (`/api/me` per role) — the `authz-tests` skill extends it.

## Dockerfile

Multi-stage on the Node LTS Alpine image (exact tag): install with the workspace lockfile, `prisma generate`, `nest build`, `pnpm deploy --filter @sbank/api --prod` into a runtime stage; `USER node`; `EXPOSE 3000`; `HEALTHCHECK` hitting `/health`; command runs `prisma migrate deploy` only through a separate one-off service in compose (not on every start).
