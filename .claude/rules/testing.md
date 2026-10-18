---
paths:
  - '**/*.spec.ts'
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - '**/test/**'
  - '**/__tests__/**'
  - '**/e2e/**'
---

# Testing rules

- Jest everywhere (`jest-expo` preset in `app`, `ts-jest` or `@swc/jest` in `api`), supertest for API e2e, React Native Testing Library for components.
- Name tests by behaviour: `it('returns 404 when the account belongs to another customer')`. Arrange–Act–Assert with a blank line between blocks.
- One behaviour per test; no logic (loops, conditionals) inside tests except `it.each` tables.
- Factories (`buildAccount({ balanceGrosze: 10_000n })`) instead of shared mutable fixtures. Each e2e test creates its own data and does not depend on order.
- No real network: NBP client is replaced with a fake; Keycloak is replaced by a local JWKS — the test helper generates an RSA key pair at startup and signs tokens with jose (`issueTestToken({ role: 'customer', acr: '1' })`). No secrets in test files.
- Fixed clock (`jest.useFakeTimers({ now: … })` or an injected clock) for anything with expiry, limits per day, or `auth_time`.
- Authorization tests live in `api/test/authz/` as a matrix (`role × endpoint → expected status`) generated from the "Czego NIE może" column in `README.md`; each row references the role and the forbidden action in its name.
- Negative token tests are mandatory for the auth layer: expired, wrong `iss`, wrong `aud`, `alg: none`, HS256 with the public key as secret, missing `acr` on step-up routes.
- App tests query by role and accessible label (`getByRole('button', { name: … })`), not by test ids, and cover loading, empty, error and success states.
- Coverage is a signal, not a goal; domain modules (`domain/`, `src/shared/lib`) aim for full branch coverage.
