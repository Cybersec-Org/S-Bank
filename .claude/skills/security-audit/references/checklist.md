# S-Bank security checklist

Each block: requirement → what to verify in code or config → where. MASVS = OWASP MASVS v2, APIx = OWASP API Security Top 10 (2023).

## Authentication and tokens — SR-01, SR-03, SR-04 (MASVS-AUTH, API2)

- [ ] Login only via OIDC Authorization Code + PKCE (S256) in the system browser; no WebView login, no password field in the app (`app/src/features/auth`).
- [ ] `state` (and `nonce` for ID token) checked on the redirect; redirect URIs in the realm are exact, no wildcards (`infra/keycloak/realm-sbank.json`).
- [ ] API verifies JWT with jose: JWKS from the configured issuer, explicit `algorithms` allowlist (no `none`, no HS*), `issuer`, `audience`, `exp`/`nbf` with ≤ 5 s tolerance (`api/src/security/auth`).
- [ ] Unknown `kid` handled by JWKS refresh with rate limit, not by accepting the token.
- [ ] Principal built only from verified claims; roles read from the expected claim path; no role from headers or body.
- [ ] Step-up: routes moving ≥ 100 000 grosze and employee/admin logins require `acr = 2` and fresh `auth_time`, checked **in the API**.
- [ ] Access token lifetime 5 min, refresh token rotation and reuse detection on, logout revokes the refresh token at Keycloak.
- [ ] Brute-force protection and password policy (`length(12) and notUsername`) in the realm (SR-02).

## Access control — SR-05 (API1, API3, API5)

- [ ] Global guard denies by default; every handler is `@Public()` or has `@Roles()`; `/public` handlers expose no customer data.
- [ ] Every query for a customer resource is scoped by owner or checked with CASL **before** any side effect; foreign resources → 404.
- [ ] Employee endpoints are read-only except block/unblock and limit change within bounds; no transfer endpoints reachable by employee/admin (README "Czego NIE może").
- [ ] Admin cannot modify balances or audit entries.
- [ ] Partner endpoints only return the partner's own payment requests; customer approval is required for every payment.
- [ ] Response DTOs expose only intended fields (no `ownerId` of others, no internal flags) — API3 property-level authorization.
- [ ] Mass assignment impossible: `forbidNonWhitelisted`, DTOs without server-controlled fields (`balance`, `status`, `ownerId`).
- [ ] Authorization matrix tests exist for every "Czego NIE może" row (`api/test/authz`).

## Input, business logic, money — SR-06, SR-07 (API6, MASVS-CODE)

- [ ] ValidationPipe `whitelist` + `forbidNonWhitelisted` + `transform`; ids `ParseUUIDPipe`; amounts integers in grosze with min/max; IBAN mod-97.
- [ ] No `$queryRawUnsafe`/`$executeRawUnsafe`, no string-built SQL, no `eval`/`new Function`, no dynamic `require`/`import` from input.
- [ ] Transfer flow: draft stored server-side; confirmation references draft id; amount/recipient not re-sent on confirm; draft expires; one confirmation per draft.
- [ ] Balance + daily limit check and booking in one `$transaction` with `SELECT … FOR UPDATE`; DB `CHECK (balance_grosze >= 0)`.
- [ ] `Idempotency-Key` required on money-moving POSTs, unique per owner, same response on replay.
- [ ] Payment requests from QR/links: app fetches by id; expiry and status checked server-side on approve.

## Transport and partner zone — SR-08 (MASVS-NETWORK)

- [ ] Caddy: HTTPS only, TLS ≥ 1.2, HSTS; HTTP → HTTPS redirect; no plain-HTTP API exposure.
- [ ] `/partner/*` requires client certificate from the S-Bank CA (`require_and_verify`); API checks the token `cnf.x5t#S256` against the certificate thumbprint forwarded by Caddy, and only trusts that header from Caddy's network.
- [ ] App talks only to the configured base URL; no `http://` in production config; no cleartext traffic allowed in native config.

## Device storage and platform — SR-09, SR-12 (MASVS-STORAGE, MASVS-PLATFORM)

- [ ] Refresh token only via `expo-secure-store` with `requireAuthentication`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; web keeps tokens in memory.
- [ ] No tokens/financial data in `AsyncStorage`, `localStorage`, `sessionStorage`, Query persistence, logs, navigation params, crash reports.
- [ ] Android `allowBackup: false`; app switcher snapshot hides sensitive screens.
- [ ] Deep links/QR carry only an id with strict format validation; App Links / Universal Links verified (`assetlinks.json`, `apple-app-site-association`); custom scheme only as fallback.
- [ ] WebView: allowlisted HTTPS origins, `javaScriptEnabled={false}`, no `injectedJavaScript`, no `onMessage`, `originWhitelist` not `*`, file access off.
- [ ] Permissions requested only at use, with rationale; denial handled.
- [ ] Mock mode and role switcher unreachable when `EXPO_PUBLIC_API_MODE=live`.

## Secrets and crypto — SR-10 (MASVS-CRYPTO)

- [ ] No secrets in code, tests, Dockerfiles, compose, workflows, `app.config.ts` or `EXPO_PUBLIC_*`; `.env` git-ignored; `.env.example` only placeholders.
- [ ] Signing key for confirmations created non-extractable in SoftHSM; signing via PKCS#11 only; public key published at `/public/keys`.
- [ ] Randomness from `node:crypto` / `expo-crypto`; no `Math.random()` for ids, tokens or keys.
- [ ] No home-made crypto or token formats.

## Abuse and external APIs — SR-11, SR-16 (API4, API7, API10)

- [ ] Throttling on `/public`, auth-related routes and transfers (429 problem); Caddy limits as a second layer.
- [ ] NBP client: fixed base URL, `AbortSignal.timeout`, zod-validated response, cache, graceful fallback; no user-controlled URLs anywhere (SSRF).
- [ ] Pagination with max page size on list endpoints.

## Web and API headers — SR-13 (API8)

- [ ] helmet on the API; CSP, HSTS, `X-Content-Type-Options`, `frame-ancestors 'none'`, `Referrer-Policy` on the web app (Caddy).
- [ ] CORS allowlist from config, no `*`, no credentials with wildcard.
- [ ] Swagger UI disabled in production; `X-Powered-By` removed; errors as problem details without stack traces.

## Audit and logging — SR-14 (A09)

- [ ] Audit records for logins (Keycloak events or API first-call), transfers, employee views, limit/block changes, role changes — with actor, action, resource, time, IP, `acr`.
- [ ] Audit table append-only at DB level (grants + trigger) and covered by a test.
- [ ] pino redaction covers authorization headers, tokens, IBANs, balances; no `console.*` in app/api source.

## Supply chain and CI — SR-15 (API8, MASVS-CODE)

- [ ] Lockfile committed, `--frozen-lockfile` in CI, `minimumReleaseAge` set, no pre-release dependencies, new dependencies justified.
- [ ] Actions pinned to commit SHAs; `permissions` minimal; `persist-credentials: false`; no `pull_request_target` with PR checkout; no untrusted `${{ }}` in `run:`.
- [ ] Dockerfiles: pinned base images, non-root, no secrets in layers, healthchecks; Trivy clean for HIGH/CRITICAL fixable.
- [ ] Keycloak not in dev mode outside local; admin console not routed; no default passwords.
