# ADR-0001: Stos technologiczny, struktura repozytorium i praca z agentami AI

- **Status:** Przyjęta (2026-10-13)
- **Autorzy:** zespół S-Bank
- **Powiązania:** SR-01 – SR-16, B-01 – B-05

## Kontekst

S-Bank ma działać w przeglądarce, na Androidzie i iOS z jednej bazy kodu, mieć własne API z bazą danych i pokazywać gotowe, poprawnie skonfigurowane mechanizmy bezpieczeństwa (karta projektu, REQUIREMENTS.md). Zespół liczy 4 osoby, a szkielet ma być gotowy na zajęcia Z2. Część pracy wykonują agenci AI (Claude Code), więc reguły muszą być zapisane jawnie i egzekwowane technicznie.

## Rozważane opcje

1. **Monorepo pnpm: Expo (React Native) + NestJS + Prisma + PostgreSQL** – jeden język (TypeScript), wspólny kontrakt OpenAPI, react-native-web daje wersję webową. Wada: dwa ekosystemy narzędzi (Metro/Expo i Nest) w jednym repozytorium.
2. **Osobne repozytoria app i api** – prostsza konfiguracja każdego z nich, ale trudniejsze utrzymanie kontraktu, CI i przeglądów zmian obejmujących obie strony.
3. **Backend-as-a-Service (Firebase/Supabase)** – szybki start, ale mniej okazji do pokazania kontroli dostępu po stronie serwera, step-up i mTLS, na których opiera się ocena.

## Decyzja

- **Opcja 1.** Katalogi `app/` (`@sbank/app`), `api/` (`@sbank/api`), `infra/`, `docs/`, `scripts/` w jednym workspace pnpm.
- **Kontrakt:** API generuje `api/openapi.json` (commitowany); aplikacja generuje z niego typy (`openapi-typescript`) i używa `openapi-fetch`. Brak współdzielonego pakietu z ręcznie pisanymi typami. CI sprawdza, czy kontrakt jest aktualny.
- **Prisma pozostaje na wersji 7.x** (tag `latest` w npm wskazuje wersję przedpremierową 8.x). Zmiana wersji głównej wymaga nowego ADR.
- **Widoki są na razie makietami** opartymi na neutralnych tokenach (`app/src/shared/ui/theme.ts`) i repozytoriach `mock`; docelowy wygląd podmieni tylko warstwę UI.
- **Agenci AI nie wykonują operacji Git** (commit, push, gałęzie). Commity robi właściciel repozytorium. Egzekwują to reguły uprawnień i hooki w `.claude/`, a nie tylko instrukcje.
- **Bezpieczeństwo łańcucha dostaw:** lockfile, `minimumReleaseAge` w pnpm, cooldown w Dependabot, akcje GitHub przypięte do SHA (po incydencie trivy-action z marca 2026 r.).

## Wersje (aktualizuje `/bootstrap-project`, faza 0)

Stan na 2026-10-18. Przypięte są wersje opublikowane co najmniej 14 dni wcześniej; wyjątkiem są pakiety Expo SDK 57, które `npx expo install --fix` dopasowuje do bieżącego zestawu poprawek (3–6 dni, powyżej karencji `minimumReleaseAge`), bo ściślejsze przypięcie powoduje zdublowane moduły natywne i błąd `expo-doctor`.

| Element              | Wersja                  | Źródło                            |
| -------------------- | ----------------------- | --------------------------------- |
| Node.js              | 24 LTS (testowane 24.x) | `.nvmrc`                          |
| pnpm                 | 12.9.1                  | `package.json` › `packageManager` |
| TypeScript           | ~6.0.3                  | `package.json`                    |
| Expo SDK             | 57 (`expo` 57.0.30)     | `app/package.json`                |
| React Native / React | 0.86.3 / 19.2.3         | zgodnie z Expo SDK                |
| NestJS               | 12.1.2 (ESM)            | `api/package.json`                |
| Prisma ORM           | 7.10.0                  | `api/package.json`                |
| PostgreSQL           | 18.6                    | `infra/docker-compose.yml`        |
| Keycloak             | 26.7.5                  | `infra/docker-compose.yml`        |
| Caddy                | 2.11.7                  | `infra/docker-compose.yml`        |
| Mailpit              | 1.31.4                  | `infra/docker-compose.yml`        |

Uwagi do wersji:

- **Node.js:** 24 jest aktywnym LTS do 2026-10-20, potem wsparciem utrzymaniowym do 2028-04-30. Node 26 zostaje LTS 2026-10-28; przejście wymaga zmiany `.nvmrc` i przeglądu tego ADR.
- **TypeScript 7** (`latest` w npm) jest odrzucony: `typescript-eslint` i `@nestjs/swagger` go nie wspierają. Zostajemy przy 6.0.x.
- **Expo SDK 58** wyszedł 2026-10-15, czyli w okresie karencji. Wracamy do aktualizacji po 2026-10-29 przez skill `dependency-update`.
- **Prisma:** tag `latest` w npm wskazuje wersję 8.0.0-rc, dlatego wersja jest przypięta dokładnie (7.10.0). Plik konfiguracji ma nazwę `prisma7.config.ts`, żeby nie pomylić go z formatem Prisma 8.
- **pnpm 11+:** klucze `onlyBuiltDependencies` zostały zastąpione przez `allowBuilds` w `pnpm-workspace.yaml`; nieznany klucz w tym pliku przerywa instalację.
- **Keycloak:** import realmu wymaga pliku o nazwie `<realm>-realm.json` (`infra/keycloak/sbank-realm.json`).

## Konsekwencje

- Pozytywne: jeden język i jeden pipeline; kontrakt API sprawdzany automatycznie; zasady bezpieczeństwa egzekwowane w CI i w narzędziach agentów.
- Negatywne: konfiguracja monorepo z Expo wymaga uwagi (izolowane `node_modules`; w razie problemów `nodeLinker: hoisted` z adnotacją w tym ADR).
- Wracamy do decyzji, jeśli Expo lub NestJS przestaną wspierać pnpm workspace albo zespół zrezygnuje z wersji webowej.
