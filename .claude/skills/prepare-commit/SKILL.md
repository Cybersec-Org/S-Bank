---
name: prepare-commit
description: Prepare the hand-over of finished work for the project owner, who commits manually — group the working-tree changes into logical commits with Conventional Commit messages, flag risky files, and summarize verification. Never stages or commits. Use at the end of any task that changed files, or when asked for a commit message or change summary.
allowed-tools: Bash(git status *) Bash(git diff *) Bash(git log *)
---

# Prepare commit (hand-over only)

You **never** run `git add`, `git commit`, `git stash` or any other Git write. The owner commits. Your output is text.

## Working tree

```!
git status --short --untracked-files=all 2>/dev/null || echo "(not a git repository — summarize from the files you changed in this session)"
```

```!
git diff --stat 2>/dev/null || true
```

```!
git log --oneline -8 2>/dev/null || true
```

## Steps

1. Read the full diff of each changed file (`git diff -- <file>`) and look at untracked files you created.
2. **Risk scan** — flag explicitly:
   - anything that looks like a secret, a `.env` file, a key or certificate (must not be committed — tell the owner to remove it);
   - lockfile changes (which dependencies changed and why);
   - new or changed migrations (destructive? backfill?);
   - changes to `.github/workflows`, `.claude/`, `infra/` (security-sensitive configuration);
   - generated files that changed without their source (or the reverse).
3. **Group** the changes into the smallest set of logical commits that each build and pass tests on their own, in dependency order (db → api → contract → app → infra → docs).
4. For each commit write:
   - a Conventional Commit message in English: `type(scope): imperative summary` (≤ 72 chars), types `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `build`, `perf`, `security`; scope = feature or package (`transfers`, `api`, `app`, `infra`, `ci`);
   - a body with _why_, the FR/SR/B ids (`Refs: FR-05, SR-07, B-18`) and breaking changes (`BREAKING CHANGE:`) if any;
   - the exact file list.
5. **Verification summary** — which `quality-gate` steps ran and their results, what was skipped and why, open review findings.

## Output format

```
## Podsumowanie zmian
<2–4 sentences in Polish: what and why>

## Ryzyka do sprawdzenia przed commitem
- …

## Proponowane commity
### 1. feat(transfers): create transfer draft endpoint
Files: api/src/modules/transfers/…, api/test/…
Message:
    feat(transfers): create transfer draft endpoint

    Drafts are stored server-side so the confirmation refers to an id and
    the amount cannot be changed after approval.

    Refs: FR-05, SR-07, B-18

### 2. …

## Weryfikacja
| Krok | Wynik |
| --- | --- |
```

Use Polish for the prose sections (the owner's language) and English for commit messages.
