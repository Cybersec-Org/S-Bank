---
name: authz-tests
description: Generate and extend the API authorization test matrix from the README roles table ("Czego NIE może"), plus token and step-up negative tests. Use when adding or changing an API route, a role, an ownership rule, or when asked for authorization/BOLA/IDOR tests (B-16, B-34, SR-05, T-01).
argument-hint: '[feature or endpoint]'
---

# Authorization tests

Scope: `$ARGUMENTS` (empty = all routes).

The authorization matrix is the executable version of the roles table in `README.md` (section "Role użytkowników", columns "Co może" / "Czego NIE może"). Every "Czego NIE może" bullet that maps to an API call must have at least one row.

## Files

- `api/test/authz/matrix.ts` — the data: an array of rows.
- `api/test/authz/authz.e2e-spec.ts` — runs `it.each(matrix)` against the Nest app with the test token verifier and a seeded database.
- `api/test/helpers/test-tokens.ts` — `issueTestToken({ subject, roles, acr, authTime, audience, issuer, expiresIn, alg })` signing with a key pair generated at test start (local JWKS). Never real Keycloak, never committed keys.
- `api/test/helpers/authz-fixtures.ts` — two customers (A and B) with accounts, recipients, payment requests; one employee; one admin; partners P1 and P2.

## Row shape

```ts
export interface AuthzRow {
  /** Reference to the forbidden action, e.g. 'customer: odczytać rachunku innego klienta' */
  readonly rule: string;
  readonly actor: 'guest' | 'customerA' | 'customerB' | 'employee' | 'admin' | 'partnerP1';
  readonly acr?: '1' | '2';
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Path with fixture placeholders resolved at runtime, e.g. '/api/accounts/:accountOfCustomerB' */
  readonly path: string;
  readonly body?: Record<string, unknown>;
  readonly expectedStatus: 401 | 403 | 404 | 422 | 429;
  readonly ids: readonly string[]; // ['SR-05', 'T-01']
}
```

## Procedure

1. Read the roles table and list every route in scope (controllers' decorators and `api/openapi.json`).
2. For each role × route, decide the expected outcome:
   - not authenticated → **401**;
   - authenticated, role not allowed → **403**;
   - role allowed, resource owned by someone else → **404** (never 403 — it would reveal existence);
   - allowed role and owner but `acr` too low on a step-up route → **403** with problem type `step-up-required`;
   - partner calling `/api` or customer calling `/partner` → **401/403** depending on the zone guard.
3. Write rows only for refusals (positive cases belong to the feature's e2e tests), named with the Polish rule text so a failing test points at the README row.
4. Add the mandatory token negatives once per zone (not per route): expired, `nbf` in the future, wrong `iss`, wrong `aud`, `alg: none`, HS256 signed with the public key, unknown `kid`, missing `sub`.
5. For money routes add: transfer from another customer's account (404), above daily limit (422), ≥ 1 000 zł with `acr=1` (403), stale `auth_time` (403), replay with the same `Idempotency-Key` produces one effect.
6. Run `pnpm run api:test:e2e -- authz`. A failing row is either a bug (fix the code, not the row) or a wrong expectation (fix the row and explain in the hand-over).
7. Update the coverage note at the top of `matrix.ts`: which README bullets are covered, which are not testable through the API (e.g. Keycloak-only rules) and where those are verified instead.
