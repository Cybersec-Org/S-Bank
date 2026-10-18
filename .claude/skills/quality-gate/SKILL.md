---
name: quality-gate
description: Run the same checks as CI locally (format, lint, typecheck, unit tests, build, Expo bundles, OpenAPI/app-type drift, Prisma validation and, with the stack up, migrations, drift and e2e) and fix what fails. Use before handing over any code change or when asked to verify, check or make CI green.
argument-hint: '[full | app | api | quick]'
allowed-tools: Bash(pnpm run *) Bash(git status *) Bash(git diff *)
---

# Quality gate

Mode: `$ARGUMENTS` (empty = full). `quick` = format, lint, typecheck and tests of the touched packages only.

## Current state

```!
git status --short 2>/dev/null || echo "(not a git repository)"
```

## Checks, in CI order

Stop at the first failing step, fix the cause (not the check), rerun that step, continue.

| #   | Step                                 | Command                                                                                                                                                                                             | Mode      |
| --- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Formatting                           | `pnpm run format:check` (fix with `pnpm run format`)                                                                                                                                                | all       |
| 2   | Lint                                 | `pnpm run lint`                                                                                                                                                                                     | all       |
| 3   | Types                                | `pnpm run typecheck`                                                                                                                                                                                | all       |
| 4   | Unit/component tests                 | `pnpm run test`                                                                                                                                                                                     | all       |
| 5   | Prisma schema                        | `pnpm run api:prisma:validate`                                                                                                                                                                      | full, api |
| 6   | Contract drift                       | `pnpm run api:openapi:generate` then `pnpm run app:api:types`, then `git diff --stat -- api/openapi.json app/src/shared/api/schema.d.ts` — any diff must be intended and mentioned in the hand-over | full, api |
| 7   | Build                                | `pnpm run build`                                                                                                                                                                                    | full      |
| 8   | Expo bundles                         | `pnpm run app:export:web`, `pnpm run app:export:native`                                                                                                                                             | full, app |
| 9   | Expo doctor                          | `pnpm run app:doctor`                                                                                                                                                                               | full, app |
| 10  | DB + e2e (needs `pnpm run infra:up`) | `pnpm run api:db:migrate:deploy`, `pnpm run api:db:check-drift`, `pnpm run api:test:e2e`                                                                                                            | full, api |
| 11  | Dependencies                         | `pnpm audit --audit-level high`                                                                                                                                                                     | full      |

If Docker is not running, skip step 10 and say so explicitly in the report.

## Rules while fixing

- Never weaken a check to make it pass: no `eslint-disable` without a specific rule and reason, no `--passWithNoTests` for new code, no `skip`/`only` in tests, no lowering coverage thresholds, no `any`.
- A flaky test is a bug: find the nondeterminism (time, order, network) and remove it.
- If a fix needs a decision (dependency upgrade, API change), stop and ask.

## Report

A short table: step → pass / fail / skipped (reason). Then the list of files you changed while fixing.
