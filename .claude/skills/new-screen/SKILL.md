---
name: new-screen
description: Add or change a screen in the Expo app (app/) — route, feature screen, hook, mock and http repository, states, Polish copy, accessibility and tests. Use for any new view, form or navigation change in the mobile/web app.
argument-hint: '[route path] [feature] [FR-xx]'
---

# New screen

Target: `$ARGUMENTS`

Follow `.claude/rules/app.md`. The visual design is not final: build with shared primitives and tokens only.

## Steps

1. **Route.** Create the route file under `app/src/app/...` in the right group (`(public)`, `(customer)`, `(employee)`, `(admin)`, or top-level for deep links). It only re-exports the screen. Register it in the group layout if the layout lists screens (tabs, titles from `pl.ts`).
2. **Model.** Types for what the screen shows in `features/<f>/model/` — derived from the generated API schema (`components['schemas'][...]`) when the endpoint exists; otherwise a local type with a `// B-xx` note to switch to the generated one.
3. **Repository.** Add the method to `features/<f>/api/<f>.repository.ts`, implement it in `<f>.mock.ts` (deterministic demo data, artificial delay, edge cases: empty list, error toggle for tests) and in `<f>.http.ts` (openapi-fetch call; map `ApiProblem` to typed errors). Keep the mock realistic enough to design against.
4. **Hook.** `use<Thing>Query` / `use<Action>Mutation` with keys from the feature `queryKeys`. Mutations invalidate exactly the affected keys. Money-moving mutations send an `Idempotency-Key` (`Crypto.randomUUID()` per user intent, reused on retry).
5. **Screen.** In `features/<f>/screens/<Name>Screen.tsx`: `Screen` wrapper with title, loading/empty/error/success states, `MockBadge` in mock mode, copy from `pl.ts`, primitives from `shared/ui`. Extract pieces bigger than ~40 lines into `features/<f>/components/`.
6. **Forms.** Controlled inputs with inline validation that mirrors the API rules (IBAN checksum, amount format → grosze, required fields) using helpers from `shared/lib`; the server stays the authority. Disable submit while pending; show server problem details in Polish.
7. **Security checks** (MASVS): no tokens or financial data in navigation params, storage or logs; deep-link params validated and only ids; permission prompts at moment of use with a rationale screen; nothing sensitive in screen titles (app switcher). Step-up flows explain why confirmation is needed.
8. **Accessibility.** Roles and labels on every touchable, logical focus order, readable at 200 % font scale, works with a screen reader on the main path.
9. **Web.** Check the layout at phone width and desktop width (`max content width` container for employee/admin screens).
10. **Tests.** `features/<f>/screens/<Name>Screen.test.tsx`: success, loading, empty, error (from the mock repository), main interaction; hooks tested through the screen unless they hold logic.

## Checks

`pnpm run lint`, `pnpm run typecheck`, `pnpm --filter @sbank/app run test -- <Name>`, then `pnpm run app:export:web`.
