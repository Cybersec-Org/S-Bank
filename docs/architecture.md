# Architektura S-Bank

Mapa modułów, stref API i miejsc, w których realizowane są wymagania bezpieczeństwa. Schemat przepływu danych i granice zaufania są w [diagramy.md](diagramy.md), decyzje w [docs/adr](adr/), wymagania w [REQUIREMENTS.md](../REQUIREMENTS.md).

Stan: szkielet (Z2). Ekrany aplikacji pracują na danych demonstracyjnych (`mock`), a API ma jedną chronioną trasę (`GET /api/me`) i weryfikator tokenów, który odrzuca wszystko, dopóki nie powstanie B-11.

## 1. Strefy API

Strefa to prefiks adresu o innym poziomie zaufania. Caddy przekazuje do API tylko poniższe prefiksy; `/health` jest wewnętrzny.

| Strefa       | Kto                            | Wymagania                                                    | Stan                                                          |
| ------------ | ------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------- |
| `/public/*`  | gość                           | bez tokenu, osobny limit zapytań (`public`)                  | strefa zdefiniowana; pierwszy endpoint `/public/rates` w B-15 |
| `/api/*`     | klient, pracownik, admin       | token użytkownika, rola w `@Roles()`, własność zasobu (CASL) | `GET /api/me`; weryfikator tokenów w trybie „odrzuć wszystko” |
| `/partner/*` | partner (klient maszynowy)     | mTLS + token związany z certyfikatem (RFC 8705)              | zamknięta (Caddy zwraca 403) do B-26                          |
| `/health`    | tylko sieć wewnętrzna (Docker) | bez tokenu, nie jest routowany przez Caddy                   | sprawdza połączenie z bazą                                    |

Strażnik `AuthGuard` odrzuca trasę bez deklaracji `@Public()` albo `@Roles()` (403), `@Public()` poza `/public` i `/health` oraz każdą trasę spoza stref (`api/src/security/zones.ts`).

## 2. Mapa modułów API (`api/src`)

| Moduł                     | Odpowiedzialność                                                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main.ts`, `app.setup.ts` | uruchomienie; jedna funkcja `configureApp()` ustawia helmet, CORS, walidację, logi, Swagger (filtr błędów jest rejestrowany w `app.module.ts` przez `APP_FILTER`) |
| `config/`                 | zmienne środowiskowe walidowane przez zod przy starcie (`env.schema.ts`), stałe domyślne (`defaults.ts`)                                                          |
| `security/auth/`          | `AuthGuard`, `@Public`, `@Roles`, `@RequireStepUp`, `Principal`, `TokenVerifier`, weryfikator odrzucający                                                         |
| `security/authz/`         | `AbilityFactory` (CASL): reguły dla klienta, pracownika, admina i partnera; domyślnie odmowa                                                                      |
| `security/throttling/`    | nazwane profile limitów (`default`, `public`, `auth`, `transfers`) i nagłówek `Retry-After`                                                                       |
| `common/`                 | filtr błędów RFC 9457, potok walidacji, identyfikator żądania, zegar, sortowanie kluczy OpenAPI                                                                   |
| `audit/`                  | `AuditService.record(...)` — jedyny zapis do `audit_log`, tylko `INSERT`                                                                                          |
| `prisma/`                 | `PrismaService` z adapterem `PrismaPg`                                                                                                                            |
| `health/`                 | `GET /health` (`SELECT 1`, bez szczegółów w odpowiedzi błędu)                                                                                                     |
| `modules/me/`             | `GET /api/me` — kim API uważa wywołującego                                                                                                                        |
| `logging/`                | pino z redakcją tokenów, ciasteczek, haseł, IBAN i sald                                                                                                           |
| `openapi/`                | budowa dokumentu OpenAPI; `scripts/generate-openapi.ts` zapisuje `api/openapi.json` bez bazy i sieci                                                              |

Warstwy: kontroler (HTTP, DTO) → serwis (przypadek użycia, autoryzacja zasobu) → repozytorium (tylko Prisma). Nowa funkcja to jeden folder w `modules/<funkcja>/`.

Baza (`api/prisma`): modele `Customer`, `Account`, `Transaction`, `AuditLog`; pierwsza migracja `init_core` zawiera ograniczenia `CHECK` (saldo, kwota, limit, kształt IBAN i waluty), wyzwalacz blokujący `UPDATE`/`DELETE`/`TRUNCATE` na `audit_log` oraz uprawnienia roli `sbank_app` (tylko `INSERT` do `audit_log`). `seed.ts` zakłada dwóch klientów demonstracyjnych.

## 3. Mapa modułów aplikacji (`app/src`)

| Miejsce               | Zawartość                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `app/`                | wyłącznie trasy Expo Router; każda to jednolinijkowe ponowne wyeksportowanie ekranu                              |
| `features/<funkcja>/` | `screens/`, `components/`, `hooks/`, `api/` (interfejs repozytorium, `*.mock.ts`, `*.http.ts`), `model/`         |
| `shared/api/`         | wybór repozytoriów wg `EXPO_PUBLIC_API_MODE`, klient `openapi-fetch`, `schema.d.ts` (generowany), błędy RFC 9457 |
| `shared/auth/`        | sesja w pamięci, role, magazyn `secure-storage` (natywnie SecureStore, w web pamięć)                             |
| `shared/ui/`          | neutralne tokeny (`theme.ts`) i prymitywy; docelowy wygląd podmieni tylko tę warstwę                             |
| `shared/lib/`         | grosze (`money.ts`), IBAN (`iban.ts`), daty, identyfikatory z linków (`ids.ts`)                                  |
| `shared/i18n/pl.ts`   | cały tekst interfejsu po polsku                                                                                  |

Funkcje: `auth`, `accounts`, `transfers`, `recipients`, `payments`, `rates`, `atms`, `content`, `settings`, `employee`, `admin` (te same nazwy co moduły API, gdzie istnieją po obu stronach). Funkcja nie importuje wnętrza innej funkcji — tylko jej `index.ts`; pilnuje tego reguła ESLint.

Tryby: `mock` (dane demonstracyjne, widoczny przełącznik ról) i `live` (repozytoria `http`, które zgłaszają `NotImplementedYet` z numerem zadania, dopóki endpoint nie powstanie). Paczka produkcyjna bez jawnego `EXPO_PUBLIC_API_MODE=mock` działa w trybie `live`.

## 4. Infrastruktura (`infra/`)

Szczegóły i polecenia: [infra/README.md](../infra/README.md). Usługi: Caddy (jedyne publikowane porty 80 i 443), `web` (statyczny eksport aplikacji), `api`, `migrate` (jednorazowo, rola `sbank_migrator`), Keycloak, dwie bazy PostgreSQL (aplikacji i Keycloak) oraz Mailpit. Sieć `internal` nie ma trasy na zewnątrz. Realm Keycloak jest w repozytorium: [infra/keycloak/sbank-realm.json](../infra/keycloak/sbank-realm.json).

## 5. Gdzie realizowane jest każde wymaganie bezpieczeństwa

„Zadanie” oznacza, że mechanizm powstanie w podanym zadaniu z [BACKLOG.md](../BACKLOG.md).

| SR    | Stan w szkielecie                                                                                                                    | Gdzie                                                                                                 | Zadanie            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------ |
| SR-01 | klient publiczny z PKCE S256 i dokładnymi adresami przekierowań jest w realmie; logowanie w aplikacji jeszcze nie                    | `infra/keycloak/sbank-realm.json`                                                                     | B-07 (realm), B-10 |
| SR-02 | polityka haseł 12 znaków i blokada czasowa po 10 błędach są w realmie                                                                | `infra/keycloak/sbank-realm.json`                                                                     | B-07               |
| SR-03 | reguła `acr`/`auth_time` w API i dekorator są gotowe; passkeys i poziomy LoA w Keycloak jeszcze nie                                  | `api/src/security/auth/step-up.ts`, `step-up.decorator.ts`                                            | B-20               |
| SR-04 | token 5 min i rotacja refresh tokenu w realmie; weryfikacja podpisu w API jeszcze nie (obecnie odrzuca każdy token)                  | `infra/keycloak/sbank-realm.json`, `api/src/security/auth/fail-closed-token-verifier.ts`              | B-11               |
| SR-05 | domyślna odmowa, role, reguły CASL, 404 dla cudzego zasobu (reguły gotowe, zasoby w kolejnych zadaniach); testy macierzy autoryzacji | `api/src/security/auth/auth.guard.ts`, `api/src/security/authz/ability.factory.ts`, `api/test/authz/` | B-12, B-16, B-34   |
| SR-06 | walidacja `whitelist` + `forbidNonWhitelisted`, ograniczenia `CHECK` w bazie; IBAN i grosze po stronie aplikacji                     | `api/src/common/validation-pipe.ts`, migracja `init_core`, `app/src/shared/lib/`                      | B-18 (IBAN w API)  |
| SR-07 | ograniczenia w bazie są; projekt przelewu, blokada wiersza i klucz idempotencji jeszcze nie                                          | migracja `init_core`                                                                                  | B-18               |
| SR-08 | TLS 1.2/1.3 i HSTS w Caddy; mTLS dla `/partner` jeszcze nie (strefa zamknięta)                                                       | `infra/caddy/Caddyfile`                                                                               | B-26               |
| SR-09 | interfejs magazynu (SecureStore natywnie, pamięć w web), brak tokenów w pamięci trwałej; faktyczne tokeny jeszcze nie                | `app/src/shared/auth/secure-storage.ts`, `secure-storage.web.ts`                                      | B-14, B-21         |
| SR-10 | sekrety tylko z `.env` generowanego skryptem; skan sekretów w CI; klucz w HSM jeszcze nie                                            | `scripts/dev-secrets.mjs`, `.gitleaks.toml`, `.github/workflows/security.yml`                         | B-28               |
| SR-11 | profile limitów `public`, `auth`, `transfers` i nagłówek `Retry-After`; dostrojenie w zadaniu                                        | `api/src/security/throttling/`                                                                        | B-25               |
| SR-12 | walidacja identyfikatora z linku; kamera, linki weryfikowane i WebView jeszcze nie                                                   | `app/src/shared/lib/ids.ts`                                                                           | B-23, B-30         |
| SR-13 | helmet z CSP dla API, nagłówki i CSP strony w Caddy, skan ZAP w CI                                                                   | `api/src/app.setup.ts`, `infra/caddy/Caddyfile`, `.github/workflows/dast.yml`                         | B-31               |
| SR-14 | tabela `audit_log` tylko do dopisywania (wyzwalacz + uprawnienia), `AuditService`; wpisy z funkcji jeszcze nie                       | migracja `init_core`, `api/src/audit/`, `api/test/db/audit-immutability.e2e-spec.ts`                  | B-29               |
| SR-15 | CI: format, lint, typy, testy, kontrakt OpenAPI, skan statyczny, zależności, sekrety, obrazy                                         | `.github/workflows/`, `.github/dependabot.yml`                                                        | B-05, B-17, B-32   |
| SR-16 | stały adres NBP i walidacja zod są w konfiguracji; klient NBP i trasa wyjściowa z sieci `internal` jeszcze nie                       | `api/src/config/env.schema.ts`                                                                        | B-15               |
