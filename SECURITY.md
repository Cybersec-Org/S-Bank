# Polityka bezpieczeństwa – S-Bank

S-Bank jest projektem akademickim (BAiSM, DevSecOps). Nie przetwarza prawdziwych pieniędzy ani danych klientów – wszystkie konta, salda i dane osobowe są demonstracyjne.

## Zgłaszanie podatności

Nie zakładaj publicznego zgłoszenia (issue) dla podatności. Użyj **GitHub → Security → Report a vulnerability** (prywatne zgłoszenie) albo napisz bezpośrednio do osoby odpowiedzialnej za DevSecOps w zespole (README → Członkowie zespołu).

W zgłoszeniu podaj: opis, kroki do odtworzenia, wpływ, wersję (commit) i ewentualny pomysł na poprawkę. Potwierdzimy otrzymanie w ciągu 3 dni roboczych.

## Zakres

| W zakresie                                                 | Poza zakresem                                                              |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| kod w `app/`, `api/`, konfiguracja w `infra/` i `.github/` | ataki DoS na środowisko zajęciowe                                          |
| omijanie kontroli dostępu, step-up, mTLS, walidacji        | socjotechnika wobec członków zespołu                                       |
| wycieki tokenów, sekretów, danych                          | podatności w zależnościach bez wpływu na S-Bank (zgłoś je autorom pakietu) |

## Jak dbamy o bezpieczeństwo

- Wymagania bezpieczeństwa SR-01–SR-16 i model zagrożeń T-01–T-11 w `REQUIREMENTS.md`.
- Każdy PR przechodzi pipeline **Security**: gitleaks, Semgrep (reguły własne w `.semgrep/` + zestawy OWASP), CodeQL (gdy włączone), `pnpm audit`, Trivy (zależności, IaC, obrazy), actionlint i zizmor dla workflowów. Błędy wysokiej wagi blokują scalenie.
- Cotygodniowe skany: Security (nowe podatności w zależnościach) i DAST (OWASP ZAP baseline na uruchomionym środowisku).
- Dependabot z opóźnieniem (cooldown) dla nowych wersji; akcje GitHub przypięte do pełnych SHA.
- Sekrety wyłącznie w `.env` (poza repozytorium) generowanym przez `scripts/dev-secrets.mjs`.

## Wycieki sekretów

Jeśli sekret trafił do repozytorium: natychmiast go **unieważnij i wygeneruj nowy** (samo usunięcie z historii nie wystarczy), poinformuj zespół, a następnie usuń go z historii.
