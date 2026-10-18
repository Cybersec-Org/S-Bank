---
name: adr
description: Record an architecture decision (ADR) in docs/adr in Polish — context, options considered, decision, consequences, links to FR/SR/T ids. Use when a decision affects structure, security mechanisms, data model, dependencies, infrastructure or deviates from an existing ADR, or when the user asks to document a decision.
argument-hint: '[short decision title]'
---

# Architecture decision record

Decision: `$ARGUMENTS`

## Steps

1. List `docs/adr/` and take the next number (`0002`, `0003`, …). Read related ADRs; if this decision replaces one, the old ADR gets `Status: Zastąpiona przez ADR-xxxx` and the new one links back.
2. Copy `docs/adr/0000-szablon.md` to `docs/adr/<number>-<kebab-case-title>.md`.
3. Fill it in Polish, concisely:
   - **Kontekst** — the problem and constraints (course requirements, SR-xx, deadlines Z2–Z5).
   - **Rozważane opcje** — at least two real options with honest pros/cons (security, complexity, team skills, time).
   - **Decyzja** — what we do, stated so it can be checked in code review.
   - **Konsekwencje** — positive, negative, follow-up tasks (B-xx proposals), what would make us revisit it.
   - **Powiązania** — FR/SR/T/B ids, files.
4. Status `Proponowana` until the user confirms; then `Przyjęta` with the date.
5. If the decision changes rules agents follow, propose the matching edit to `AGENTS.md` or `.claude/rules/` in the same change.
