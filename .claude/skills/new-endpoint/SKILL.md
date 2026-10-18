---
name: new-endpoint
description: Add or change a REST endpoint in the NestJS API (api/) with zone, roles, step-up, CASL ownership, DTO validation, idempotency, audit, rate limit, OpenAPI and tests. Use for any new or modified API route.
argument-hint: '[METHOD /zone/path] [FR-xx/SR-xx]'
---

# New endpoint

Target: `$ARGUMENTS`

Follow `.claude/rules/api.md`. Fill this design card first (in your notes or the PR summary), then implement.

| Item        | Decide                                                                      |
| ----------- | --------------------------------------------------------------------------- |
| Zone        | `/public` (anonymous), `/api` (user token), `/partner` (mTLS + bound token) |
| Roles       | which roles may call it; everything else 403                                |
| Ownership   | which field ties the resource to the caller; foreign → 404                  |
| Step-up     | needed? (≥ 1 000 zł, employee/admin actions) → `@RequireStepUp()`           |
| Idempotency | money-moving or retry-sensitive POST → `Idempotency-Key` required           |
| Audit       | which `AuditService.record` action, in the same transaction                 |
| Rate limit  | throttler profile: `public`, `auth`, `transfers` or default                 |
| Errors      | domain errors → problem types (`/problems/<slug>`)                          |

## Steps

1. **DTOs** in `dto/`: request DTO with class-validator decorators (`@IsUUID`, `@IsInt`, `@Min(1)`, `@Max(...)`, `@Length`, custom `@IsPolishIban`), no optional fields without a reason; response DTO with `@ApiProperty` — explicit fields only, never Prisma entities. Amounts as integer grosze.
2. **Domain** in `domain/`: pure functions for rules (limit remaining, step-up needed, status transitions) and typed domain errors. Unit-test them first.
3. **Repository**: Prisma queries scoped by owner where applicable (`where: { id, ownerId }`); row locks through tagged `$queryRaw` inside the service's transaction.
4. **Service**: one method per use case; authorization of the resource (ownership/CASL) before any side effect; `$transaction` for multi-write operations; audit inside the transaction; idempotency lookup/insert with unique constraint.
5. **Controller**: zone-prefixed path, decorators (`@Roles`, `@RequireStepUp`, `@Throttle`/profile, `@Public` only for `/public`), `ParseUUIDPipe` for ids, OpenAPI annotations for success and each error status (400, 401, 403, 404, 409, 422, 429).
6. **Module wiring**: register in the feature module; no circular imports.
7. **Contract**: `pnpm run api:openapi:generate`, then `pnpm run app:api:types`; check the diff is what you intended.
8. **Tests**:
   - unit: domain + service with repository fakes;
   - e2e (supertest): happy path, validation (extra field → 400, wrong types), not-found vs foreign (both 404), conflict/idempotency (same key → same result, no double effect), throttling where the profile is strict;
   - authz: add matrix rows via the `authz-tests` skill for every role that must be refused and for token negatives on step-up routes.

## Checks

`pnpm run lint`, `pnpm run typecheck`, `pnpm --filter @sbank/api run test -- <feature>`, `pnpm run api:test:e2e` (stack running), contract drift clean.
