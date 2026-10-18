# ADR-0002: Wyjątki w audycie zależności i poprawki przez `overrides`

- **Status:** Przyjęta (2026-10-18)
- **Autorzy:** zespół S-Bank
- **Powiązania:** SR-15, T-08, B-17

## Kontekst

Zadanie CI `Security / dependency-audit` uruchamia `pnpm audit --audit-level high` i blokuje scalenie przy znalezisku wysokiej wagi (SR-15). Na szkielecie audyt zwrócił 4 znaleziska wysokiej wagi i 4 umiarkowane, wszystkie w zależnościach przechodnich narzędzi, nie w kodzie, który sami piszemy:

| Pakiet (wersja)      | Znalezisko                                        | Skąd                                           | Poprawka dostępna               |
| -------------------- | ------------------------------------------------- | ---------------------------------------------- | ------------------------------- |
| `deepmerge-ts` 7.1.5 | GHSA-ggr8-5vv4-36mx, wysoka                       | CLI Prisma (`@prisma/config`)                  | tak: 8.0.2                      |
| `mysql2` 3.15.3      | GHSA-3f6p-5ww8-9rcr (wysoka), GHSA-rgwj-5xj2-c3m3 | CLI Prisma (obsługa MySQL, której nie używamy) | tak: 3.24.5                     |
| `braces` 3.0.3       | GHSA-vfj7-8cjw-p6xm, wysoka                       | Expo / Metro (serwer deweloperski)             | nie: 3.0.3 to najnowsze wydanie |
| `node-forge` 1.4.0   | GHSA-86w9-cpqp-85rv, wysoka                       | Expo CLI (podpisywanie kodu EAS)               | nie: 1.4.0 to najnowsze wydanie |

Żaden z tych pakietów nie trafia do paczki aplikacji ani do obrazu uruchomieniowego API (cel `runtime`; sprawdzono wynikiem `pnpm deploy --prod`, który zawiera tylko `@prisma/client`). `braces` i `node-forge` działają wyłącznie w narzędziach budowania i serwerze deweloperskim Expo. `deepmerge-ts` i `mysql2` należą do CLI `prisma`, które jest tylko w jednorazowym obrazie migracji (cel `migrate`) i w środowisku deweloperskim, nie obsługuje ruchu.

## Rozważane opcje

1. **Wyjątki dla wszystkich znalezisk.** Zalety: brak zmian w zależnościach. Wady: zostawia poprawki, które już istnieją.
2. **`overrides` dla pakietów z poprawką, wyjątki tylko dla tych bez poprawki.** Zalety: usuwa to, co da się usunąć; wyjątki zostają minimalne. Wady: `overrides` omijają zakresy zgłoszone przez Prisma, więc trzeba sprawdzić, czy jego CLI nadal działa.
3. **Wyłączyć zadanie albo obniżyć próg do `critical`.** Odrzucone: osłabia kontrolę SR-15.

## Decyzja

Opcja 2.

- W `pnpm-workspace.yaml` są dwa `overrides`: `deepmerge-ts: 8.0.2` (BSD-3-Clause) i `mysql2: 3.24.5` (MIT); obie wersje mają ponad 14 dni. Po zmianie sprawdzono, że działają `prisma validate`, `prisma generate` i `prisma migrate diff`.
- W `auditConfig.ignoreGhsas` są dokładnie dwa wyjątki: GHSA-vfj7-8cjw-p6xm (`braces`) i GHSA-86w9-cpqp-85rv (`node-forge`). Każdy ma w pliku komentarz z powodem.
- Próg audytu pozostaje `high`; żaden inny identyfikator nie może trafić na listę wyjątków bez nowego wpisu w tym ADR.
- Skan obrazów Trivy (`.trivyignore`): trzy wyjątki dla Caddy 2.11.7 zbudowanego na Go 1.26.8 — CVE-2026-78667 (nagłówek Range), CVE-2026-78669 (HTTP/2 SETTINGS) i CVE-2026-97031 (rozszerzenie TLS ECH). To najnowsze wydanie Caddy 2.11, a poprawki są dopiero w Go 1.26.9 i 1.27.2, więc obrazu z poprawką jeszcze nie ma. Wszystkie trzy to odmowa usługi, bez wykonania kodu i bez dostępu do danych. Dotyczą obrazu `web` oraz brzegowego Caddy (ten sam obraz). Termin przeglądu: **2026-11-01** albo pojawienie się obrazu Caddy zbudowanego na Go ≥ 1.26.9 — wtedy podnosimy obraz w `infra/docker-compose.yml` i `app/Dockerfile` i usuwamy wpisy. Opcja własnego budowania Caddy (`caddy:builder` na Go 1.26.9) została odrzucona: dokłada łańcuch budowania do utrzymania dla trzech podatności typu odmowa usługi.

## Konsekwencje

- Pozytywne: audyt przechodzi bez osłabiania progu; lista wyjątków jest krótka, jawna i sprawdzalna w przeglądzie kodu.
- Negatywne / koszty: dopóki wpisy `overrides` istnieją, nie wynikają z zależności Prisma i trzeba je pamiętać przy jego aktualizacji. Wyjątki ukrywają dwa znaleziska w narzędziach Expo.
- Umiarkowane znaleziska, które zostają i nie blokują CI: `uuid` 7.0.3 (GHSA-w5hq-g745-h8pq, narzędzia konfiguracji Expo), `decode-uri-component` (GHSA-vcc3-ghjq-m6fr, `query-string` w Expo Router), `sprintf-js` (GHSA-hp3w-g68c-fv3c, narzędzia testowe). Dwa pierwsze mają poprawki; nie nadpisujemy ich, bo Expo samo dopasowuje te wersje (`npx expo install --fix`), a nadpisanie mogłoby zepsuć `expo prebuild`.
- Zadania do wykonania: przy każdej aktualizacji Prisma lub Expo usunąć `overrides` i wyjątki, które przestały być potrzebne.
- Kiedy wrócimy do tej decyzji: **do 2026-11-18**, przy aktualizacji Expo SDK (po 2026-10-29) albo gdy pojawi się wydanie `braces` lub `node-forge` z poprawką — zależnie od tego, co nastąpi pierwsze.
