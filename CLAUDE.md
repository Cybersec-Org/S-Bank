@AGENTS.md

# Claude Code in this repository

The rules above apply to you and to every subagent. This section adds how to work here with Claude Code's skills, agents and guardrails.

## First run

If `pnpm-workspace.yaml` does not exist yet, the project has not been scaffolded. Tell the user to run `/bootstrap-project` and do not scaffold piecemeal on your own.

## Pick the workflow by task

| Task                                                        | Use                                   |
| ----------------------------------------------------------- | ------------------------------------- |
| Scaffold the empty repository (one time)                    | `/bootstrap-project`                  |
| New functionality end to end (an FR or a backlog item B-xx) | `new-feature` skill                   |
| New or changed screen                                       | `new-screen` skill                    |
| New or changed REST endpoint                                | `new-endpoint` skill                  |
| Database schema change                                      | `db-migration` skill                  |
| Authorization tests from the roles table                    | `authz-tests` skill                   |
| Security review of a change or the whole repo               | `security-audit` skill                |
| New attack surface (link, permission, external call, zone)  | `threat-model` skill                  |
| Architecture decision or deviation from an ADR              | `adr` skill                           |
| Add or upgrade a dependency                                 | `dependency-update` skill             |
| Before handing over any code change                         | `quality-gate`, then `prepare-commit` |

## Delegate to the project agents

- `architect` — plan a feature or a cross-cutting change before writing code; owns ADRs.
- `mobile-developer` (`app/`), `backend-developer` (`api/`), `database-engineer` (`api/prisma/`), `identity-engineer` (Keycloak, OIDC, passkeys, step-up, biometrics), `devsecops-engineer` (`infra/`, `.github/`, Docker, Caddy, mTLS, HSM).
- `test-engineer` — tests, especially authorization matrices.
- `security-auditor` and `code-reviewer` — read-only reviews; run them on every non-trivial change before handing over.
- `docs-researcher` — confirm current library APIs, versions and configuration in official docs. Use it whenever you are not sure an API, flag or config key still exists; do not guess from memory.

Give subagents the FR/SR/B ids and file paths they need — they do not see this conversation.

## Guardrails you will hit

- Git write commands, `gh` write commands and publishing are blocked by `.claude/settings.json` and `.claude/hooks/guard-bash.mjs`. When work is done, stop at the summary from `prepare-commit`. Do not look for another way to run Git.
- `.env`, private keys and certificates are unreadable for you. If you need a secret value, ask the user to set it; never print one.
- Committed migrations, generated files and the guardrail files (`.claude/settings.json`, `.claude/hooks/`) are write-protected by `.claude/hooks/protect-files.mjs`. Propose changes to guardrails in chat; the user applies them.
- Run package scripts as `pnpm run <script>` — those are pre-approved. Adding, removing or upgrading dependencies always asks the user.

## Working style

- Small, reviewable steps. After each step run the narrowest relevant check (one test file, one package's `typecheck`) before moving on; run the full `quality-gate` at the end.
- When requirements are ambiguous or a decision is hard to reverse (data model, security mechanism, public API shape), ask before building.
- Report honestly: if a check was skipped or failed, say so in the summary.
