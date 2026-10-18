---
name: threat-model
description: Update the STRIDE threat model (REQUIREMENTS.md §6, T-xx) and the linked security requirements when a change adds attack surface — a new zone or route, deep link, permission, WebView, external call, stored data, role or infrastructure component — or after test/scan results (B-35). Use when asked to analyze threats or risks of a change.
argument-hint: '[feature or component]'
---

# Threat model update

Subject: `$ARGUMENTS`

## Steps

1. Read `REQUIREMENTS.md` §4 (SR), §5 (sensitive elements) and §6 (T-01…), `docs/diagramy.md` (trust boundaries) and the code or plan of the subject.
2. Draw the data flow for the subject in words: actors, entry points, data crossing each trust boundary (device ↔ Caddy ↔ API ↔ DB/Keycloak/HSM/NBP, partner ↔ `/partner`).
3. For each element apply STRIDE (S spoofing, T tampering, R repudiation, I information disclosure, D denial of service, E elevation of privilege). Keep only threats that are plausible for this app.
4. For each kept threat decide: already covered by an existing T-xx (extend its "Czego dotyczy" / controls) or new T-xx (next free number; never renumber).
5. Map each threat to controls and requirements: existing SR-xx, or propose a new SR-xx with "Jak realizujemy" and "Jak sprawdzamy" (a test or scan, not just intent).
6. Check that each control is real: point to the code/config/test that implements it, or to the backlog item that will (add a B-xx proposal if none).
7. **Show the proposed table rows to the user before editing `REQUIREMENTS.md`** — it is a graded course document. After approval, edit it keeping the existing table format and Polish language.
8. If a risk is accepted rather than mitigated, record it with the reason in an ADR (`adr` skill).

## Row format (REQUIREMENTS.md §6)

`| T-xx | **<zagrożenie>** – <opis>. (<STRIDE>) | <czego dotyczy> | <możliwe konsekwencje> | <planowana kontrola / działanie> | <SR-xx> |`
