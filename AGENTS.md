# S-Bank — instructions for coding agents

S-Bank is a deliberately small banking app (web + Android + iOS) built for two university courses: _Bezpieczeństwo aplikacji i systemów mobilnych_ (BAiSM) and _DevSecOps_. Its purpose is to demonstrate correctly configured, off-the-shelf security mechanisms — OIDC + PKCE, passkeys with step-up, mTLS (RFC 8705), PKCS#11 (SoftHSM) and server-side access control — on a working app. Functionality stays small; security quality is the grade.

## Sources of truth

Read the relevant one before designing or changing behaviour. Never contradict them silently — if code and docs disagree, say so.

| File               | What it defines                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| `REQUIREMENTS.md`  | FR-xx (functional), SR-xx (security), sensitive data, threat model T-xx                                  |
| `README.md`        | project card: roles table "Co może / Czego NIE może" (basis of authorization tests), data classification |
| `BACKLOG.md`       | tasks B-xx per milestone Z2–Z5                                                                           |
| `docs/diagramy.md` | flow, architecture and trust boundaries, transfer sequence                                               |
| `docs/adr/`        | architecture decisions — follow them, add a new ADR to change one                                        |

## Stack

TypeScript everywhere, pnpm workspace, Node.js Active LTS (see `.nvmrc`).

- `app/` — React Native + Expo (Expo Router, react-native-web), TanStack Query, openapi-fetch. One codebase for iOS, Android and web.
- `api/` — NestJS (REST, OpenAPI via `@nestjs/swagger`), Prisma ORM **7.x** + PostgreSQL, jose (JWT), CASL, class-validator, helmet, `@nestjs/throttler`, nestjs-pino.
- `infra/` — Docker Compose: PostgreSQL (app) + PostgreSQL (Keycloak), Keycloak, Caddy (TLS, mTLS for `/partner`), Mailpit, SoftHSM2.
- External: NBP Web API (exchange rates), called **only by the API**.

Versions are not taken from memory: check `package.json`, the lockfile and the official docs. Prisma stays on major 7 (`latest` on npm is a Prisma 8 pre-release). Expo packages are installed with `npx expo install` so they match the SDK.

## Repository layout

```
app/      Expo app — src/app (routes only), src/features/<feature>, src/shared
api/      NestJS — src/modules/<feature>, src/security, src/audit, prisma/
infra/    docker-compose.yml, caddy/, keycloak/ (realm as code), softhsm/
docs/     ADRs, diagrams, security mechanism write-ups, reviews
scripts/  helper scripts (dev secrets, backlog import)
```

The detailed target tree lives in `.claude/skills/bootstrap-project/references/target-structure.md`.

## Commands

Run everything from the repository root. CI calls exactly these scripts — keep the names stable.

| Script                                                                                                                                                                                                    | Purpose                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                                                                                                                                          | install (never edit `pnpm-lock.yaml` by hand)                       |
| `pnpm run format:check` / `pnpm run format`                                                                                                                                                               | Prettier                                                            |
| `pnpm run lint` · `pnpm run typecheck` · `pnpm run test` · `pnpm run build`                                                                                                                               | all workspaces                                                      |
| `pnpm run app:start` · `pnpm run app:export:web` · `pnpm run app:export:native` · `pnpm run app:doctor` · `pnpm run app:build:android`                                                                    | Expo                                                                |
| `pnpm run app:api:types`                                                                                                                                                                                  | regenerate `app/src/shared/api/schema.d.ts` from `api/openapi.json` |
| `pnpm run api:dev` · `pnpm run api:test:e2e` · `pnpm run api:openapi:generate`                                                                                                                            | API                                                                 |
| `pnpm run api:prisma:generate` · `pnpm run api:prisma:validate` · `pnpm run api:db:migrate:dev --name <name>` · `pnpm run api:db:migrate:deploy` · `pnpm run api:db:check-drift` · `pnpm run api:db:seed` | database                                                            |
| `pnpm run infra:up` · `pnpm run infra:down` · `pnpm run infra:logs`                                                                                                                                       | local stack                                                         |

## Architecture rules

- **Contract first.** The API's OpenAPI document (`api/openapi.json`, generated) is the only contract between `app` and `api`. The app uses generated types; no hand-written copies of DTOs.
- **API zones** are URL prefixes with different trust: `/public/*` (anonymous, rate limited), `/api/*` (user token), `/partner/*` (mTLS + certificate-bound token). `/health` is internal only.
- **API layering:** controller (HTTP, DTO, decorators) → service (use case, transactions, authorization of the resource) → repository (Prisma only). Controllers never touch Prisma; repositories never contain business rules.
- **App layering:** route file in `src/app` is a thin re-export of a screen from `src/features/<feature>/screens`. Screens get data from hooks; hooks call a repository interface; the repository has a `mock` and an `http` implementation selected by `EXPO_PUBLIC_API_MODE`.
- **Mocked UI for now.** The visual design is not decided yet. Screens use only primitives and tokens from `app/src/shared/ui` so the design can be swapped in one place. Do not copy colours, fonts or layouts from any mockup unless asked.
- One feature = one folder on each side, with the same name (`transfers` in app and api).

## Security invariants (never break, never "temporarily" disable)

1. **Deny by default.** Every API route requires a valid token unless explicitly marked `@Public()`. Every non-public route declares its roles. Unknown → 401/403.
2. **Ownership on every resource** via CASL policies in `api/src/security/authz`. A resource that belongs to someone else returns **404**, not 403.
3. **Tokens:** verify signature with an explicit algorithm allowlist, `iss`, `aud`, `exp` (jose + JWKS). Step-up operations check `acr` and `auth_time` **in the API**, never only in the app.
4. **Input:** DTOs with `whitelist` + `forbidNonWhitelisted`; amounts are integers in **grosze**; IBAN validated; database access only through Prisma or tagged-template `$queryRaw` — never `$queryRawUnsafe` / `$executeRawUnsafe`.
5. **Transfers:** draft saved on the server, confirmation refers to the draft id; balance and daily limit checked in one DB transaction with a row lock (`SELECT … FOR UPDATE`); idempotency key on money-moving requests. Step-up threshold 1 000 zł (100 000 grosze), default daily limit 5 000 zł.
6. **Device storage:** refresh token only in `expo-secure-store` (biometric-bound); access token and financial data only in memory; on web, tokens only in memory — never `localStorage`, `sessionStorage` or `AsyncStorage`.
7. **Logs and errors** never contain tokens, passwords, full IBANs, balances or stack traces sent to clients. Errors use RFC 9457 problem details.
8. **Secrets** never in the repo, code, tests, logs or chat. Config comes from environment variables validated at startup; `.env.example` holds placeholders only.
9. **Audit log** is append-only (DB grants allow INSERT only): logins, transfers, employee views of customer data, role changes — who, what, when, IP, `acr`.
10. **Mobile platform:** deep links and QR codes carry only an id; payment data is fetched from the API and explicitly confirmed. WebView only for allowlisted HTTPS URLs, JavaScript off, no native bridge. Permissions are requested at the moment of use.
11. **External calls** (NBP) use a fixed base URL, timeout, schema validation (zod) and cache. No user-supplied URLs.
12. **Dependencies:** add only when needed, from maintained packages, pinned via lockfile; never install pre-releases; review the change in the summary.

When a change touches any of these, run the `security-audit` skill before handing over.

## Code standards

- TypeScript `strict`; no `any`, no non-null `!`, no `@ts-ignore` (use `@ts-expect-error` with a reason only in tests). Validate at boundaries, trust types inside.
- Small, single-purpose functions and modules; names say what, not how (`calculateRemainingDailyLimit`, not `calc2`). No abbreviations except domain terms (IBAN, OIDC, acr).
- No dead code, commented-out code, unexplained TODOs, or magic numbers — use named constants (`STEP_UP_THRESHOLD_GROSZE`).
- Errors: throw typed domain errors in services, map them to HTTP in one exception filter. Never swallow errors.
- Comments explain _why_, not _what_. Public functions and modules get a one-line TSDoc when the intent is not obvious.
- Immutability by default (`const`, `readonly`, no parameter mutation). Pure functions for domain rules (limits, IBAN, money) so they are unit-testable.
- Code, identifiers, comments and commit messages in **English**. UI copy and documents in `docs/` and the root `*.md` files in **Polish**; UI strings live in `app/src/shared/i18n/pl.ts`.
- Formatting is Prettier's job; lint must pass with zero warnings.

## Tests

- Every behaviour change ships with tests: unit (domain rules), API e2e with supertest, app component tests with React Native Testing Library.
- Every row of the "Czego NIE może" column in `README.md` has an automated authorization test (`api/test/authz`).
- Tests are deterministic: no real network, fixed clock, factories instead of shared fixtures, no real secrets (tests sign tokens with a key generated in the test).

## Git and change policy

- **Agents never commit, stage, push, branch, tag, stash, reset or rewrite history.** The project owner does all Git operations. Read-only Git (`status`, `diff`, `log`, `show`, `blame`) is fine.
- Leave changes in the working tree and hand over with a summary: what changed, why, how it was verified, and a suggested Conventional Commit message (`feat(transfers): …`, `fix(api): …`, `chore(ci): …`).
- Never edit an already-committed Prisma migration; create a new one.
- Never edit generated files (`app/src/shared/api/schema.d.ts`, `api/src/generated/**`, `pnpm-lock.yaml`) by hand — regenerate them.

## Definition of done

1. Linked to FR/SR/B ids where they exist; docs updated if behaviour or architecture changed.
2. `format:check`, `lint`, `typecheck`, `test`, `build` pass locally; OpenAPI and app types regenerated if the API changed.
3. Authorization tests cover new routes; security invariants above still hold.
4. Summary with suggested commit message handed to the owner — nothing committed.
