# Infrastruktura lokalna S-Bank

Stos Docker Compose (`infra/docker-compose.yml`, projekt `sbank`) do pracy lokalnej, CI i skanu DAST. Na zewnątrz wystawiony jest wyłącznie Caddy.

## Usługi

| Usługa     | Obraz                                  | Sieci              | Port na hoście | Zdrowie (`healthcheck`)                         |
| ---------- | -------------------------------------- | ------------------ | -------------- | ----------------------------------------------- |
| `caddy`    | `caddy:2.11.7-alpine`                  | `edge`, `internal` | `80`, `443`    | admin API na pętli zwrotnej kontenera (`:2019`) |
| `web`      | build `app/Dockerfile`                 | `internal`         | brak           | `wget` na `:8080/index.html`                    |
| `api`      | build `api/Dockerfile`                 | `internal`         | brak           | `wget` na `:3000/health`                        |
| `migrate`  | build `api/Dockerfile` (cel `migrate`) | `internal`         | brak           | zadanie jednorazowe (kończy się kodem 0)        |
| `keycloak` | `keycloak:26.7.5` (`start-dev`)        | `internal`         | brak           | `/health/ready` na porcie zarządzania `9000`    |
| `app-db`   | `postgres:18.6-alpine`                 | `internal`         | brak           | `pg_isready` przez TCP                          |
| `kc-db`    | `postgres:18.6-alpine`                 | `internal`         | brak           | `pg_isready` przez TCP                          |
| `mailpit`  | `axllent/mailpit:v1.31.4`              | `internal`         | brak           | `mailpit readyz`                                |

Profil `dev-ports` (opcjonalny) dokłada trzy małe przekaźniki TCP (`dev-port-postgres`, `dev-port-mailpit`, `dev-port-keycloak`) opublikowane tylko na `127.0.0.1`: PostgreSQL `5432`, interfejs Mailpit `8025`, Keycloak `8080`.

Sieci:

- `edge` — tylko Caddy. To jedyna sieć z opublikowanymi portami.
- `internal` (`internal: true`, bez trasy na zewnątrz) — API, Keycloak, obie bazy, Mailpit, web, migracje. Caddy też do niej należy, żeby przekazywać ruch. API nie ma więc jeszcze drogi do NBP: wyjście (serwer pośredniczący tylko do `api.nbp.pl`) zostanie zaprojektowane w B-15 i opisane w ADR.
- `devtools` — tylko przekaźniki z profilu `dev-ports` (opublikowane porty nie działają w sieci `internal`).

Trasy Caddy: `/` → `web` (także `/oauth/callback` i `/oauth/logged-out`, powroty OIDC aplikacji web), `/api/*` i `/public/*` → `api`, pozostałe `/auth/*` → `keycloak`, `/partner/*` → `403` (zamknięte do B-26). Nigdy nie są kierowane: `/health`, `/auth/admin*`, `/auth/realms/master*`, `/auth/metrics*`, `/auth/health*` (odpowiedź `404`). Nagłówek `X-Frame-Options: DENY` dostają wszystkie trasy poza `/auth/*`: konsola konta Keycloak osadza własne strony (kontrola ciasteczek, status logowania) w ramkach tej samej domeny, więc globalny `DENY` kończy się błędem „Timeout when waiting for 3rd party check iframe message”. Keycloak stosuje tam własne `frame-ancestors 'self'`. Wzmocnienie: każdy kontener ma `cap_drop: [ALL]` i `no-new-privileges`; dodane uprawnienia (Caddy `NET_BIND_SERVICE`, PostgreSQL `CHOWN`, `DAC_OVERRIDE`, `FOWNER`, `SETGID`, `SETUID`) mają uzasadnienie w komentarzach pliku Compose.

## Pierwsze uruchomienie

```bash
node scripts/dev-secrets.mjs      # tworzy .env z losowymi sekretami (nie nadpisuje istniejącego)
pnpm run infra:up                 # docker compose --env-file .env -f infra/docker-compose.yml up -d --wait
```

`infra:up` nie przebudowuje obrazów po zmianie kodu. Po zmianie w `api/` lub `app/` użyj:

```bash
docker compose --env-file .env -f infra/docker-compose.yml up -d --build --wait
```

Kolejność startu wynika z `depends_on`: bazy i Mailpit → Keycloak → migracje (`migrate`, rola `sbank_migrator`) → API (rola `sbank_app`) → web → Caddy. Pierwszy start trwa kilka minut (budowanie obrazów, start Keycloak).

Po starcie (`pnpm run infra:logs` pokazuje logi):

```bash
curl -k https://localhost/            # aplikacja web (HTML)
curl -k https://localhost/api/me      # 401, problem+json
curl -k -o /dev/null -w '%{http_code}\n' https://localhost/partner/x   # 403
curl -k -o /dev/null -w '%{http_code}\n' https://localhost/auth/admin/ # 404
```

Wersja web budowana w Compose używa `EXPO_PUBLIC_API_MODE=mock` (dane demonstracyjne), dopóki nie ustawisz `EXPO_PUBLIC_API_MODE=live` w `.env` i nie przebudujesz obrazu `web`.

## Zaufanie do lokalnego urzędu certyfikacji Caddy

`tls internal` oznacza, że Caddy podpisuje certyfikat dla `localhost` własnym urzędem, którego klucz leży w woluminie `caddy-data`. Przeglądarka ostrzeże, dopóki nie zaufasz certyfikatowi głównemu. Wyeksportuj go poza repozytorium (pliki `*.crt` nie są ignorowane przez Git):

```bash
docker compose --env-file .env -f infra/docker-compose.yml cp caddy:/data/caddy/pki/authorities/local/root.crt ~/sbank-caddy-root.crt
```

Potem dodaj `~/sbank-caddy-root.crt` do magazynu zaufanych urzędów systemu lub przeglądarki (Linux: `/usr/local/share/ca-certificates/` i `sudo update-ca-certificates`; macOS: Dostęp do pęku kluczy; Windows: `certutil -addstore -user Root`). Zaufaj tylko certyfikatowi głównemu z własnego woluminu, nigdy cudzemu. Po `down --volumes` Caddy tworzy nowy urząd, więc certyfikat trzeba wyeksportować i dodać ponownie.

## Dostęp tylko z localhost (Mailpit, konsola Keycloak, baza)

Te usługi nie mają opublikowanych portów. Dwie drogi:

1. Profil `dev-ports` — przekaźniki nasłuchują wyłącznie na `127.0.0.1`:

   ```bash
   docker compose --env-file .env -f infra/docker-compose.yml --profile dev-ports up -d --wait
   ```

   - Mailpit: <http://localhost:8025> (wiadomości z Keycloak, np. weryfikacja e-mail).
   - Konsola administracyjna Keycloak: <http://localhost:8080/auth/admin> (`KC_HOSTNAME_ADMIN`); login z `KC_BOOTSTRAP_ADMIN_USERNAME`, hasło `KC_BOOTSTRAP_ADMIN_PASSWORD` z pliku `.env` (nie wypisuj go w terminalu ani w czacie). To konto tymczasowe: po pierwszym logowaniu utwórz własne konto administratora i usuń `temp-admin`.
   - PostgreSQL aplikacji: `localhost:5432`, baza `sbank`. Dla narzędzi lokalnych (`pnpm run api:dev`, `api:db:*`) `DATABASE_URL` z `.env.example` już na to wskazuje.

2. Bez publikowania portów, wewnątrz sieci:

   ```bash
   docker compose --env-file .env -f infra/docker-compose.yml exec app-db sh -c 'psql -U sbank_admin -d sbank'
   docker compose --env-file .env -f infra/docker-compose.yml exec kc-db sh -c 'psql -U keycloak -d keycloak'
   ```

Caddy nigdy nie kieruje ruchu do konsoli administracyjnej Keycloak ani do jego domeny `master`.

## Bazy danych: role i uprawnienia

`infra/postgres/init/01-roles.sql` wykonuje się tylko przy pierwszym starcie pustego woluminu `app-db-data` (mechanizm obrazu `postgres`). Tworzy:

- `sbank_migrator` — właściciel schematu `public` i wszystkich tabel; używany tylko przez usługę `migrate` (DDL). Bez praw superużytkownika.
- `sbank_app` — rola API w czasie działania. Nie może zmieniać schematu; uprawnienia do tabel nadają migracje Prisma (INSERT-only dla `audit_log`, bez `ALTER DEFAULT PRIVILEGES`).
- `sbank_admin` (`POSTGRES_USER`) — superużytkownik do administracji; żadna aplikacja się nim nie łączy.

Hasła ról pochodzą z `.env` (`POSTGRES_MIGRATOR_PASSWORD`, `POSTGRES_APP_PASSWORD`) i są ustawiane tylko raz, więc **zmiana hasła w `.env` po pierwszym starcie nie zmienia hasła w bazie**. Zresetuj wolumin (poniżej) albo zmień hasło w bazie ręcznie.

## Reset danych

```bash
pnpm run infra:down                                                       # zatrzymuje i usuwa kontenery, dane zostają
docker compose --env-file .env -f infra/docker-compose.yml down --volumes # usuwa też WSZYSTKIE wolumeny
```

`--volumes` kasuje obie bazy (konta, dziennik audytu, użytkownicy Keycloak) oraz urząd certyfikacji Caddy. Pojedynczy wolumin: `docker volume rm sbank_app-db-data` (analogicznie `sbank_kc-db-data`, `sbank_caddy-data`, `sbank_caddy-config`) po `down`.

Dwie rzeczy dzieją się tylko na pustych danych, więc po ich zmianie trzeba zresetować odpowiedni wolumin:

- zmiana `01-roles.sql` lub haseł ról → `app-db-data`,
- zmiana `infra/keycloak/sbank-realm.json` → `kc-db-data` (Keycloak importuje realm tylko wtedy, gdy jeszcze nie istnieje; więcej w `infra/keycloak/README.md`).

## Ograniczenia znane świadomie

- Keycloak działa w trybie `start-dev` (tylko lokalnie). Produkcja: `start` z obrazem zbudowanym przez `kc.sh build`, prawdziwy certyfikat i brak konta tymczasowego. Keycloak nie ma `read_only`, bo `start-dev` przebudowuje serwer przy starcie.
- Caddy (obraz oficjalny) działa jako root w kontenerze z jednym uprawnieniem (`NET_BIND_SERVICE`) i systemem plików tylko do odczytu. Obraz nadaje plikowi `caddy` uprawnienie plikowe, które z `cap_drop: [ALL]` i użytkownikiem bez uprawnień uniemożliwia uruchomienie; własny obraz bez niego jest możliwym ulepszeniem.
- Hasła baz trafiają do kontenerów jako zmienne środowiskowe (widoczne w `docker inspect` dla osoby z dostępem do demona Dockera). To akceptowalne lokalnie; w produkcji potrzebne są sekrety Dockera lub menedżer sekretów.
- Mutual TLS dla `/partner` (B-26): `client_auth` w Caddy działa na poziomie połączenia TLS, nie ścieżki URL, więc wymaga osobnego nasłuchu lub nazwy hosta; do tego czasu strefa jest zamknięta (`403`).
- SoftHSM2 (B-28) nie jest jeszcze częścią stosu; patrz `infra/softhsm/README.md`.
- Dziennik dostępu Caddy jest wyłączony: adresy URL przekierowań OIDC niosą jednorazowy kod autoryzacji.

## Co jest zweryfikowane, a co nie

Sprawdzone lokalnie bez Dockera: poprawność pliku Compose (`docker compose config --quiet`, także z profilem `dev-ports`), składnia i działanie tras obu plików Caddy (Caddy 2.11.7 uruchomiony poza kontenerem na atrapach usług: trasy, nagłówki, limit 1 MB, TLS 1.2+) oraz skrypt `01-roles.sql` na PostgreSQL (PGlite, z przełączaniem ról i przebiegiem migracji jako `sbank_migrator`).

Niesprawdzone, bo wymagają działającego demona Dockera: budowanie obrazów `api`, `migrate` i `web`, start kontenerów (w tym `read_only` i `cap_drop` dla PostgreSQL, Keycloak i Mailpit), wszystkie `healthcheck`, import realmu, `up --wait` oraz skany obrazów. Pierwsze uruchomienie traktuj jako test i zgłoś każdy błąd startu kontenera.
