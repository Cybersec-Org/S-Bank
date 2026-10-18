---
name: bootstrap-project
description: One-time scaffold of the empty S-Bank repository — pnpm workspace, Expo app with mocked screens, NestJS API with Prisma 7 and the first migration, Docker Compose stack, security baseline and docs — matching the CI contract. Run only when the user types /bootstrap-project.
argument-hint: '[phase: all | workspace | app | api | infra | verify]'
disable-model-invocation: true
---

# Bootstrap S-Bank

Scaffold the repository so that milestone **Z2** of `BACKLOG.md` (B-02, B-03, B-04, B-05) is met: the Expo app starts on Android and in the browser with navigable mocked screens, the API answers `/health`, Prisma has its first migration, OpenAPI is generated, Docker Compose brings up PostgreSQL, Keycloak, Mailpit and Caddy, and the CI workflows in `.github/workflows/` pass.

Phase requested: `$ARGUMENTS` (empty means `all`). Phases are idempotent: inspect what exists and continue from there.

## Ground rules for this run

- Follow `AGENTS.md`, `CLAUDE.md` and `.claude/rules/*` — they are the standard the scaffold must already meet.
- **No Git operations** (no `git init`, `add`, `commit`). If the folder is not a Git repository, tell the user once and continue.
- **Current docs, not memory.** Before each phase, have the `docs-researcher` agent confirm the current commands, versions and config keys you are about to use (list below). Use what the official generator produces; adapt it to our structure; do not hand-write files a generator owns.
- Never create `.env`. Write `.env.example` with placeholders and `__GENERATE__` markers; `node scripts/dev-secrets.mjs` creates `.env`.
- Dependencies: only what this skill names or what a generator installs. Pin exact versions in the lockfile, stable releases only.
- Keep the scaffold small and clean: no example code from templates, no unused files, no TODOs without a backlog id (`// B-11: verify JWT with jose` is fine).
- Work in the phase order; after each phase run that phase's checks and fix failures before continuing. Use the task list so the user can follow progress.

## Phase 0 — preflight (read-only)

1. Read `AGENTS.md`, `README.md` (roles table), `REQUIREMENTS.md`, `BACKLOG.md` (Z2–Z3), `docs/adr/0001-*.md`, and all files in `references/` of this skill. If README/REQUIREMENTS/BACKLOG are missing, tell the user they belong in the repo root (from the project documentation) and continue — `AGENTS.md` contains the essentials.
2. Check tools: `node --version` (must match `.nvmrc` major), `pnpm --version` (via Corepack), `docker --version`, `docker compose version`. Report anything missing and stop if Node or pnpm is unavailable.
3. Ask `docs-researcher` for a version brief covering: current Expo SDK and `create-expo-app` default template; Expo Router protected routes API; NestJS CLI `new` options and ESM default; Prisma 7 + NestJS recipe (config file name, generator, `@prisma/adapter-pg`); `@nestjs/swagger`, `@nestjs/throttler`, `nestjs-pino`, `jose`, `@casl/ability` current majors; pnpm workspace settings (`minimumReleaseAge`, build-script allowlist key name) and `pnpm deploy`; Keycloak 26.x container flags (`start-dev --import-realm`, health endpoints, management port); Caddy `tls internal`, `client_auth`; PostgreSQL 18 image; current Node.js LTS. Record the result in the version table of `docs/adr/0001-stos-technologiczny-i-struktura.md`.

## Phase 1 — workspace (`references/workspace-blueprint.md`)

Root `package.json` (scripts contract), `pnpm-workspace.yaml`, `tsconfig.base.json`, root ESLint entry, `.env.example` (all variables from `references/ci-contract.md`), README section "Uruchomienie" placeholder.

Check: `pnpm install` succeeds; `pnpm run format:check` passes.

## Phase 2 — app (delegate to `mobile-developer`; `references/app-blueprint.md`)

Create the Expo app in `app/` with the official generator, remove template examples, then build the structure, providers, mock/http repositories, shared UI primitives with neutral placeholder tokens, Polish i18n, and the mocked screens for every route in the blueprint. Tests for primitives, money/IBAN helpers, mock-mode guard and one smoke test per screen.

Check: `pnpm run lint`, `pnpm run typecheck`, `pnpm run test` (app), `pnpm run app:export:web`, `pnpm run app:export:native`, `pnpm run app:doctor`.

## Phase 3 — API (delegate to `backend-developer` and `database-engineer`; `references/api-blueprint.md`)

Create the NestJS app in `api/` with the official CLI (pnpm, strict), then: config validation, security baseline (helmet, CORS, throttler, ValidationPipe, problem-details filter, pino with redaction), deny-by-default `AuthGuard` with `@Public()`, `@Roles()`, `@RequireStepUp()` and a **fail-closed** token verifier (rejects every token until B-11), CASL `AbilityFactory` skeleton, `AuditService`, `/health` with a DB check, `GET /api/me` as the first protected route, Prisma 7 with the initial schema and migration (including audit-log grants/trigger and money CHECK constraints), seed, OpenAPI generation script, Dockerfile.

Check: `pnpm run api:prisma:validate`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run test` (api), `pnpm run build`, `pnpm run api:openapi:generate`, `pnpm run app:api:types`. With the stack from phase 4 running: `pnpm run api:db:migrate:deploy`, `pnpm run api:db:check-drift`, `pnpm run api:test:e2e`.

## Phase 4 — infra (delegate to `devsecops-engineer`, Keycloak parts to `identity-engineer`; `references/infra-blueprint.md`)

`infra/docker-compose.yml`, `infra/caddy/Caddyfile`, `infra/keycloak/realm-sbank.json` (minimal realm as code), `app/Dockerfile` (web export served as static files), healthchecks, networks, `infra/README.md`.

Check: `docker compose -f infra/docker-compose.yml config --quiet`; if Docker is available and `.env` exists (ask the user to run `node scripts/dev-secrets.mjs` if not — or run it yourself, it never prints secrets), `pnpm run infra:up`, then confirm all services are healthy with `docker compose ps`.

## Phase 5 — docs

- README: replace "Instrukcja uruchomienia pojawi się razem ze szkieletem projektu." with a short Polish "Uruchomienie" section (prerequisites, `pnpm install`, `node scripts/dev-secrets.mjs`, `pnpm run infra:up`, `pnpm run api:dev`, `pnpm run app:start`, mock vs live mode).
- `docs/architecture.md` (Polish): module map of app and api, zones, where each SR is implemented or planned (table SR → file/backlog id).
- Update the version table in ADR 0001.

## Phase 6 — verify and hand over

1. Run the `quality-gate` skill (full).
2. Run the `security-audit` skill on the whole repository; fix every finding of severity high or above, list the rest.
3. Ask `code-reviewer` for a structure and clean-code pass; apply agreed fixes.
4. Finish with the `prepare-commit` skill: proposed commits in logical order (workspace → api → app → infra → docs), each with a Conventional Commit message. Remind the user to enable branch protection for `main` with required checks `CI / ci-success` and `Security / security-gate` (B-01) and to set the repository variable `ENABLE_CODE_SCANNING=true` if the repository is public or has GitHub Code Security.

## Reference files

- `references/target-structure.md` — the full tree to produce.
- `references/ci-contract.md` — scripts, env variables, Dockerfile and Compose expectations the workflows depend on. **Do not deviate without updating the workflows.**
- `references/workspace-blueprint.md`, `references/app-blueprint.md`, `references/api-blueprint.md`, `references/infra-blueprint.md` — phase details.
