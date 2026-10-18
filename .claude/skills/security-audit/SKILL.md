---
name: security-audit
description: Security review of S-Bank code and configuration against SR-01–SR-16, OWASP MASVS and OWASP API Security Top 10 — runs available scanners and a manual checklist, returns findings with severity, location and fix. Use after security-relevant changes, before hand-over of features touching auth, money, data, links, permissions, infra or CI, or when asked for a security/vulnerability review.
argument-hint: '[changed | all | <path>]'
context: fork
agent: security-auditor
background: false
allowed-tools: Bash(git status *) Bash(git diff *) Bash(pnpm audit *) Bash(pnpm run *)
---

# Security audit

Scope: `$ARGUMENTS` — `changed` (default: working-tree changes), `all` (whole repository) or a path.

You are auditing the S-Bank repository. Read `AGENTS.md` (Security invariants), `REQUIREMENTS.md` §4–§6 and the roles table in `README.md` first; then use `${CLAUDE_SKILL_DIR}/references/checklist.md`.

## Changed files

```!
git status --short --untracked-files=all 2>/dev/null || echo "(not a git repository — audit the scope given in the arguments)"
```

## Procedure

1. **Scope.** For `changed`, read the full diff (`git diff`) plus the untracked files; also read the code the change calls into and the code that calls it — authorization bugs live at the boundaries. For `all`, walk `api/src/security`, every controller, every repository, `app/src/shared/auth`, `app/src/shared/api`, `app.config.ts`, `infra/`, `.github/workflows/`.
2. **Automated checks** (run what is available; report what was not):
   - `pnpm audit --audit-level high`
   - `docker run --rm -v "$PWD:/src" -w /src semgrep/semgrep:1.180.0 semgrep scan --config .semgrep/ --config p/typescript --config p/nodejs --config p/react --config p/owasp-top-ten --config p/jwt --metrics off --error` (only if Docker is available)
   - `docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.30.1 dir /repo --redact --no-banner` (secrets; never print a found secret — report file and line only; hits in the git-ignored `.env` are expected, report only files that are tracked or about to be committed)
3. **Manual review** with the checklist, area by area. For each item decide: OK / finding / not applicable (say why).
4. **Verify findings.** Before reporting, confirm each finding by reading the actual code path (and, where cheap, by running or writing a failing test). No speculative findings without evidence; mark uncertain ones as "needs verification".

## Severity

- **Critical** — direct loss of money or data, auth bypass, secret exposure (e.g. missing ownership check on transfers, token accepted without signature check).
- **High** — exploitable with modest effort (IDOR on read, missing step-up check in API, token in AsyncStorage, wildcard redirect URI, unpinned action with write permissions).
- **Medium** — defence-in-depth gap (missing rate limit, verbose errors, missing CSP directive, unvalidated external response).
- **Low / Info** — hardening and hygiene.

## Report (return this, in Polish, nothing else)

```
## Audyt bezpieczeństwa — <zakres>, <data>
Narzędzia: <tool → result / skipped (why)>

| # | Waga | Obszar | Wymaganie | Plik:linia | Problem | Jak naprawić |
| --- | --- | --- | --- | --- | --- | --- |

### Szczegóły
#### 1. <title>
Dowód: <code path / test>
Skutek: <what an attacker gets>
Poprawka: <concrete change>

### Sprawdzone bez uwag
<checklist areas that passed>

### Do weryfikacji ręcznej / poza kodem
<Keycloak console, device checks, TLS scan…>
```

The main conversation saves the report to `docs/security/reviews/<YYYY-MM-DD>-<scope>.md` when the user wants it kept, and fixes findings of severity medium and above.
