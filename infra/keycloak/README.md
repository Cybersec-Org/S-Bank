# Keycloak – realm `sbank` jako kod

`sbank-realm.json` to minimalna, przeglądana w PR definicja realmu `sbank` dla Keycloak 26.7 (B-07, SR-01, SR-02, SR-04, T-11). Plik nie zawiera użytkowników, haseł, sekretów klientów ani kluczy realmu – Keycloak generuje klucze przy imporcie.

Nazwa pliku musi mieć postać `<realm>-realm.json`, inaczej `--import-realm` go pominie ([Importing and exporting realms](https://www.keycloak.org/server/importExport)).

## Import

- `infra/docker-compose.yml` montuje plik tylko do odczytu jako `/opt/keycloak/data/import/sbank-realm.json`, a Keycloak startuje z `start-dev --import-realm`.
- Import działa **tylko wtedy, gdy realm jeszcze nie istnieje**. Zmiana pliku nie nadpisze realmu w istniejącej bazie.
- Żeby zastosować zmiany z pliku: `pnpm run infra:down`, usuń wolumen bazy Keycloak (`docker volume rm sbank_kc-db-data`), potem `pnpm run infra:up`. To usuwa też wszystkich użytkowników Keycloak.
- Alternatywnie: zmień ustawienie w konsoli administracyjnej (dostęp opisany w `infra/README.md`), wyeksportuj realm i przenieś zmianę do pliku. Zmiana wprowadzona tylko w konsoli nie istnieje dla repozytorium.

## Eksport zmian

Eksport wymaga **zatrzymanego** serwera Keycloak – nie uruchamiaj go przez `docker compose exec` w działającym kontenerze.

```sh
docker compose --env-file .env -f infra/docker-compose.yml stop keycloak
mkdir -p /tmp/sbank-export
docker compose --env-file .env -f infra/docker-compose.yml run --rm --no-deps \
  -v /tmp/sbank-export:/tmp/sbank-export \
  keycloak export --realm sbank --users skip --dir /tmp/sbank-export
docker compose --env-file .env -f infra/docker-compose.yml start keycloak
```

Kontener działa jako użytkownik o UID 1000, więc katalog `/tmp/sbank-export` musi być dla niego zapisywalny.

**Surowego eksportu nigdy nie commitujemy.** Zawiera klucze prywatne realmu (`components` → `org.keycloak.keys.KeyProvider`: `privateKey`, `secret`) oraz wygenerowany sekret klienta `sbank-api`. Eksport trzymaj poza repozytorium, a do `sbank-realm.json` przenieś ręcznie tylko zmienione klucze i pokaż je w PR.

## Ustawienia bezpieczeństwa i wymagania

| Ustawienie w `sbank-realm.json`                                                                                                                                                             | Wartość                                                                                                                 | SR / T                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| klient `sbank-app`: `publicClient`, tylko `standardFlowEnabled`; `implicitFlowEnabled`, `directAccessGrantsEnabled`, `serviceAccountsEnabled`, device grant, CIBA, token exchange wyłączone | Authorization Code bez sekretu klienta                                                                                  | SR-01, T-02                    |
| `pkce.code.challenge.method`                                                                                                                                                                | `S256` – żądanie bez PKCE lub z `plain` jest odrzucane                                                                  | SR-01, T-04                    |
| `redirectUris`                                                                                                                                                                              | dokładnie `https://localhost/oauth/callback`, `http://localhost:8081/oauth/callback` (bez własnego schematu `sbank://`) | SR-01, T-04, T-11              |
| `webOrigins`                                                                                                                                                                                | dokładnie `https://localhost`, `http://localhost:8081`                                                                  | SR-01, T-11                    |
| `post.logout.redirect.uris`                                                                                                                                                                 | dokładnie `…/auth/logged-out` dla tych samych trzech źródeł                                                             | SR-04, T-11                    |
| `passwordPolicy`                                                                                                                                                                            | `length(12) and notUsername`                                                                                            | SR-02, T-02                    |
| `bruteForceProtected` i parametry blokady                                                                                                                                                   | blokada czasowa po 10 nieudanych próbach (szczegóły niżej)                                                              | SR-02, T-02                    |
| `accessTokenLifespan`                                                                                                                                                                       | 300 s                                                                                                                   | SR-04, T-03                    |
| `revokeRefreshToken`, `refreshTokenMaxReuse`                                                                                                                                                | `true`, `0` – refresh token jednorazowy (rotacja)                                                                       | SR-04, T-03                    |
| `ssoSessionIdleTimeout`, `ssoSessionMaxLifespan`                                                                                                                                            | 30 min, 10 h                                                                                                            | SR-04, T-03                    |
| brak zakresu `offline_access` w `sbank-app`                                                                                                                                                 | `scope=offline_access` kończy się błędem `invalid_scope`                                                                | SR-04, T-03                    |
| `fullScopeAllowed: false` + `scopeMappings`, mapper `oidc-audience-mapper`                                                                                                                  | access token niesie tylko role `customer`/`employee`/`admin` i `aud: sbank-api`                                         | SR-04                          |
| `defaultSignatureAlgorithm`                                                                                                                                                                 | `RS256` – ten sam algorytm musi być jedynym dozwolonym w API                                                            | SR-04                          |
| `admin-cli` realmu `sbank` wyłączony                                                                                                                                                        | brak przepływu hasłem poza przeglądarką                                                                                 | SR-01, T-02, T-11              |
| `sslRequired`                                                                                                                                                                               | `external`                                                                                                              | T-11                           |
| `verifyEmail`, `registrationEmailAsUsername`, `duplicateEmailsAllowed: false`                                                                                                               | rejestracja aktywna dopiero po potwierdzeniu e-maila                                                                    | FR-01 (B-08)                   |
| `eventsEnabled`, `adminEventsEnabled`, `adminEventsDetailsEnabled: false`                                                                                                                   | zdarzenia logowania i administracyjne przez 30 dni, bez treści żądań                                                    | SR-14 (uzupełnia dziennik API) |

### Blokada po nieudanych logowaniach

- `failureFactor: 10`, strategia `LINEAR`, `waitIncrementSeconds: 60`, `maxFailureWaitSeconds: 900`: 10. nieudana próba blokuje konto na 1 minutę, każda kolejna wydłuża blokadę o minutę, maksymalnie do 15 minut.
- `maxDeltaTimeSeconds: 43200`: licznik zeruje się po 12 godzinach bez nieudanych prób.
- `quickLoginCheckMilliSeconds: 1000`, `minimumQuickLoginWaitSeconds: 60`: dwie nieudane próby w odstępie krótszym niż 1 s (skrypt, nie człowiek) blokują konto na minutę.
- `permanentLockout: false`: trwała blokada pozwoliłaby atakującemu wyłączyć dowolnego klienta samym zgadywaniem haseł. Zablokowany użytkownik widzi ten sam komunikat co przy złym haśle.

Opis parametrów: Server Administration Guide, rozdział [Brute force attacks](https://www.keycloak.org/docs/26.7.5/server_admin/index.html#password-guess-brute-force-attacks).

## Decyzje, które nie wynikają wprost z pliku

- **Rejestracja bez hasła w pierwszym kroku.** Od Keycloak 26.7 przy włączonym `verifyEmail` formularz rejestracji nie pyta o hasło. Użytkownik ustawia je po potwierdzeniu e-maila (wymagane akcje `VERIFY_EMAIL`, `UPDATE_PASSWORD`). To zalecane zachowanie, zostawiamy je ([Upgrading Guide 26.7.5](https://www.keycloak.org/docs/26.7.5/upgrading/index.html#verify-email-required-before-credentials-setup-during-user-self-registration)).
- **Rola domyślna.** Każdy nowy użytkownik dostaje `customer`. Keycloak przy imporcie zawsze dopisuje do roli domyślnej `offline_access` oraz role klienta `account` (`view-profile`, `manage-account`), więc są wpisane jawnie, żeby plik zgadzał się z eksportem. `offline_access` jest dla `sbank-app` bezużyteczne (brak zakresu, `fullScopeAllowed: false`). `uma_authorization` jest zadeklarowana tylko po to, żeby nie trafiła do roli domyślnej.
- **Zakresy klienta `sbank-app`:** `basic` (`sub`, `auth_time`), `acr`, `roles` (`realm_access.roles`), `profile`, `email`, `web-origins`. Zakresy domyślne realmu dla nowych klientów zostają wbudowane w Keycloak (klucze `defaultDefaultClientScopes` są przy imporcie bez pełnej listy `clientScopes` ignorowane), dlatego każdy klient w tym pliku wymienia swoje zakresy jawnie.
- **Klient `sbank-api`** istnieje tylko jako odbiorca tokenu i rezerwuje ten `clientId`. Nie ma żadnego przepływu, a uwierzytelnianie `client-jwt` bez skonfigurowanych kluczy uniemożliwia logowanie się nim. Keycloak i tak generuje mu sekret przy imporcie – sekret ten nie działa.
- **Wylogowanie.** Unieważnienie refresh tokenu na `/protocol/openid-connect/revoke` kończy sesję użytkownika w Keycloak. Wersja web może też użyć wylogowania przez przeglądarkę (`end_session_endpoint`) z powrotem na `/auth/logged-out`.
- **Ponowne użycie refresh tokenu.** Użycie już wymienionego refresh tokenu jest odrzucane i unieważnia sesję klienta – nowszy refresh token też przestaje działać.

## Czego tu jeszcze nie ma

- Passkeys (WebAuthn Passwordless), poziomy LoA i step-up z `acr` – B-20. Teraz zwykłe logowanie daje `acr: "1"`.
- Wymuszony passkey przy logowaniu pracownika i administratora – B-20.
- Klienci partnerów z uwierzytelnianiem X.509 i tokenami związanymi z certyfikatem (mTLS) – B-26.
- Użytkownicy testowi – nigdy z hasłami w repozytorium.
- Szablony e-maili i motyw strony logowania.

## Tylko do lokalnego rozwoju

`start-dev` służy wyłącznie do pracy lokalnej. Produkcja używa obrazu zbudowanego poleceniem `kc.sh build` i uruchamianego przez `start --optimized`, z wymuszonym `hostname`, TLS i bez konsoli administracyjnej dostępnej z internetu.

## Powrót z logowania w aplikacji natywnej

Realm nie zawiera adresu ze schematem `sbank://`. Dowolna inna aplikacja na telefonie może zarejestrować ten sam schemat i przeprowadzić własny przepływ z własnym PKCE, a potem odebrać kod przy aktywnej sesji w przeglądarce (RFC 8252 §8.6, T-04). Powrót natywny ma więc być zweryfikowanym linkiem HTTPS (Android App Links, iOS Universal Links) na domenie banku. Dodaje się go w B-10 razem z plikami `assetlinks.json` i `apple-app-site-association` serwowanymi przez Caddy oraz dokładnym adresem w `redirectUris` i `post.logout.redirect.uris`. Schemat `sbank://` pozostaje tylko dla linku `/pay/{id}`, który niesie wyłącznie identyfikator.
