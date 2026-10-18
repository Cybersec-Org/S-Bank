---
paths:
  - 'api/**'
---

# API rules (NestJS)

## Structure

- `src/modules/<feature>/` — `<feature>.module.ts`, `<feature>.controller.ts` (one per zone if needed, e.g. `partner-payment-requests.controller.ts`), `<feature>.service.ts`, `<feature>.repository.ts`, `dto/`, `domain/` (pure rules and domain errors), `policies/` (CASL rules for the feature), colocated `*.spec.ts`.
- `src/security/` — `auth/` (jose JWT verifier, global `AuthGuard`, `@Public()`, `@Roles()`, `@RequireStepUp()`, `Principal` type), `authz/` (CASL `AbilityFactory`, `PoliciesGuard`), `throttling/`, `mtls/` (certificate thumbprint check for `/partner`).
- `src/audit/` — `AuditService.record(event)`; the only writer of the audit table.
- `src/common/` — problem-details exception filter, pagination, money/IBAN value objects, request id.
- `src/config/` — zod schema for env; the app fails to start on invalid config.
- The project is ESM: relative imports end with `.js`.

## Request flow

1. Route lives in a zone: `@Controller('api/accounts')`, `@Controller('public/rates')`, `@Controller('partner/payment-requests')`. Never create routes outside `public`, `api`, `partner` (except internal `/health`).
2. The global `AuthGuard` rejects everything not marked `@Public()`. Non-public handlers declare `@Roles(...)`. Handlers that move ≥ 1 000 zł or are employee/admin actions also declare `@RequireStepUp()`, which checks `acr` and `auth_time` from the verified token.
3. DTOs use class-validator; the global `ValidationPipe` runs with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. Path ids are validated (`ParseUUIDPipe`).
4. The service loads the resource **scoped by owner** (`findByIdForOwner(id, principal.customerId)`) or checks the CASL ability; a missing or foreign resource throws `NotFoundException` — same response for both.
5. Money-moving operations run in `prisma.$transaction` with a row lock via tagged `$queryRaw` (`SELECT … FOR UPDATE`) and require an `Idempotency-Key` header stored with a unique constraint.
6. Security-relevant actions call `AuditService.record` inside the same transaction.
7. Responses are explicit response DTOs — never return Prisma entities directly. Error responses are RFC 9457 problem details without stack traces or internal ids.

## Implementation rules

- Controllers: HTTP mapping, decorators and OpenAPI annotations (`@ApiTags`, `@ApiOkResponse`, `@ApiBearerAuth`, error responses) only.
- Services: one public method per use case (`createTransferDraft`, `confirmTransfer`). Domain rules (limits, step-up threshold, IBAN checksum) are pure functions in `domain/` with unit tests.
- Repositories: Prisma calls only; return domain types.
- Config and thresholds through `ConfigService` typed accessors; constants such as `STEP_UP_THRESHOLD_GROSZE` live in one file.
- Outbound HTTP (NBP) through a dedicated client with a fixed base URL, timeout via `AbortSignal.timeout`, zod validation of the response and a cache. Never build URLs from user input.
- Logging with the pino logger; `redact` covers `authorization`, `cookie`, `set-cookie`, tokens, IBAN and balance fields. No `console.*`.
- Security headers via helmet; CORS only for origins from `CORS_ORIGINS`; throttling stricter on `/public`, login-related and transfer routes.
- Randomness from `node:crypto` (`randomUUID`, `randomBytes`) — never `Math.random()` for ids or secrets.
- Cryptographic signing (transfer confirmations) only through the PKCS#11 service (SoftHSM); no keys in process memory or files.

## Tests

- Unit: domain functions and services with repository fakes.
- E2E (supertest against the Nest app + test database): happy path, validation errors, and authorization — wrong role → 403, foreign resource → 404, missing/expired/foreign-audience/`alg: none` token → 401, low `acr` on step-up route → 403.
- After changing routes or DTOs: `pnpm run api:openapi:generate` and `pnpm run app:api:types`.
