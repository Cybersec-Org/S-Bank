---
name: new-feature
description: End-to-end workflow for a new S-Bank feature (an FR-xx requirement or backlog item B-xx) across database, API, app, tests and docs. Use when the user asks to implement, add or build functionality that spans more than one layer.
argument-hint: '[FR-xx | B-xx | short description]'
---

# New feature workflow

Feature: `$ARGUMENTS`

Work through the steps in order and keep the task list updated. Each layer is delegated to its agent with a self-contained brief (ids, files, acceptance criteria) — agents do not see this conversation.

## 1. Understand

1. Find the feature in `REQUIREMENTS.md` (FR-xx), `BACKLOG.md` (B-xx, "Powiązane") and the roles table in `README.md` ("Co może / Czego NIE może"). Collect every linked SR-xx and T-xx.
2. Read the current code of the affected feature folders (`app/src/features/<f>`, `api/src/modules/<f>`) and `docs/architecture.md`.
3. Write down acceptance criteria as testable statements, including the negative ones from "Czego NIE może".
4. If anything is ambiguous or the change is hard to reverse (data model, money flow, public API shape, security mechanism), ask the user before building — one concise question with options.

## 2. Plan (agent `architect`)

Ask `architect` for a short plan: data model changes, endpoints (zone, method, path, roles, step-up, idempotency, audit events), app routes and repository methods, test list, docs to update, and whether an ADR or a threat-model update is needed. Review it against `AGENTS.md` › Security invariants. Share the plan with the user when the feature touches money, auth or a new zone.

## 3. Build, inside-out

1. **Database** — `database-engineer` with the `db-migration` skill (schema, constraints, indexes, migration, seed).
2. **API** — `backend-developer` with the `new-endpoint` skill for each route; then `pnpm run api:openapi:generate`.
3. **Contract** — `pnpm run app:api:types`; the app's `*.http.ts` repository now uses the generated types.
4. **App** — `mobile-developer` with the `new-screen` skill: screen states, mock repository updated with realistic demo data, http repository implemented.
5. **Identity** (only if roles, scopes, step-up or Keycloak config change) — `identity-engineer`.
6. **Infra/CI** (only if a new service, port, header, zone or secret appears) — `devsecops-engineer`.

After each step run the narrowest checks for what changed before continuing.

## 4. Test (agent `test-engineer`)

- Unit tests for every new domain rule.
- API e2e for happy path and validation.
- `authz-tests` skill: one matrix row per forbidden action from the roles table, plus token/step-up negatives when relevant.
- App component tests for loading/empty/error/success.

## 5. Review

1. `quality-gate` skill (full).
2. `security-audit` skill scoped to the changed files.
3. `code-reviewer` agent on the diff.
   Fix findings of severity medium or higher; list the rest in the hand-over.

## 6. Document

- `REQUIREMENTS.md`: nothing changes unless the requirement itself changed (ask first).
- `docs/architecture.md`: update the SR → implementation table.
- `threat-model` skill if the feature added attack surface (new route zone, link, permission, external call, stored data).
- `adr` skill if a decision was made that future work must follow.

## 7. Hand over

Run `prepare-commit`. Include: FR/SR/B ids covered, what is still mocked, checks run with results, open findings. Never commit.
