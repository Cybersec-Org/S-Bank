# Diagramy sekwencji logowania – etap 4 (2026-11-25)

Nazwy tras, endpointów i parametrów pochodzą z kodu (`app/src/shared/auth/oidc.ts`, `SessionProvider.tsx`, `session-store.ts`, `api/src/auth/jwt-auth.guard.ts`, `api/src/accounts/*`), z realmu `infra/keycloak/sbank-realm.json` i z decyzji `docs/auth/01-decyzje.md`. Kroki, których jeszcze nie ma w kodzie, mają dopisek **[docelowo, etap N]**.

**Wspólne nazwy:**

- **Wystawca:** `http://localhost:8080/realms/sbank` (stały po P-04). Endpointy: `…/protocol/openid-connect/auth`, `/token`, `/revoke`, `/logout`, `/certs`.
- **Klient:** `sbank-app`, publiczny, PKCE S256.
- **Powrót z logowania:** `sbank://oauth/callback` (telefon), `http://localhost:8081/oauth/callback` (web) – D14, P-01.
- **API:** `http://localhost:3000`, bez prefiksu `/api`.

**Zmiany z etapu 9 (2026-11-26):**

- **P-17, web:** zamiast wyskakującego okna karta przechodzi do Keycloak i wraca na `/oauth/callback`. Na czas przekierowania `state`, `code_verifier` i `nonce` leżą jednorazowo w `sessionStorage`.
- **P-15:** „Zaloguj się kluczem dostępu” wysyła też scope `sbank-passkey-login`, więc Keycloak prosi od razu o klucz, bez hasła.
- **P-16:** strona Keycloak ma motyw S-Bank.

## 1. Logowanie (diagram główny)

```mermaid
sequenceDiagram
    autonumber
    actor U as Użytkownik
    participant A as Aplikacja S-Bank
    participant B as Przeglądarka systemowa
    participant K as Keycloak (realm sbank)
    participant API as API S-Bank
    participant DB as PostgreSQL

    U->>A: „Zaloguj się hasłem” / „Zaloguj się kluczem dostępu”
    A->>A: AuthRequest losuje state (10 znaków) i code_verifier (128 znaków), code_challenge = S256(code_verifier)<br/>[docelowo, etap 9] także nonce
    A->>B: GET /auth?client_id=sbank-app&response_type=code&scope=openid profile email<br/>&redirect_uri=sbank://oauth/callback (web: http://localhost:8081/oauth/callback)<br/>&state&code_challenge&code_challenge_method=S256&acr_values=1 albo 2
    B->>K: żądanie logowania
    alt acr_values=1 (hasło)
        K->>U: formularz: login (e-mail) + hasło
        U->>K: login + hasło
        opt klient [docelowo P-03, etap 6]
            K->>U: kod TOTP
            U->>K: 6 cyfr
        end
        opt pracownik lub administrator bez klucza dostępu
            K->>U: wymagane użycie / rejestracja klucza dostępu (D16)
        end
    else acr_values=2 (klucz dostępu)
        K->>U: WebAuthn (RP ID localhost, weryfikacja użytkownika wymagana)
        U->>K: podpis kluczem z urządzenia
    end
    alt 5 nieudanych prób (D10)
        K-->>U: blokada czasowa 1–15 min, poprawne hasło też odrzucane
    end
    opt pierwsze logowanie (wymagane akcje)
        K->>U: UPDATE_PASSWORD, potem CONFIGURE_TOTP (klient) albo webauthn-register-passwordless (personel)
        U->>K: nowe hasło, OTP / nowy klucz dostępu
    end
    K-->>B: 302 redirect_uri?code&state (kod ważny 60 s)
    B-->>A: powrót do aplikacji (deep link / trasa oauth/callback)
    A->>A: expo-auth-session porównuje state (niezgodny → state_mismatch, koniec)
    A->>K: POST /token: grant_type=authorization_code, code, code_verifier, redirect_uri, client_id
    K-->>A: access token (5 min), refresh token, ID token
    A->>A: access + ID + refresh token → RAM (session-store)<br/>principal z access tokenu (tylko do UI)<br/>dziś: refresh token od razu do SecureStore, [docelowo P-09, etap 11]: dopiero przy przejściu w tło i po zgodzie na biometrię
    A->>API: GET /accounts (pulpit), [docelowo, etap 10] także GET /customers/me<br/>Authorization: Bearer access token
    API->>K: JWKS z OIDC_JWKS_URL albo {wystawca}/protocol/openid-connect/certs (raz, potem z pamięci)
    API->>API: podpis RS256, iss, aud=sbank-api, azp=sbank-app, exp<br/>dokładnie jedna rola z realm_access.roles<br/>EMPLOYEE / ADMIN bez acr=2 → 403 PASSKEY_REQUIRED
    API->>DB: Customer po keycloakSub = sub (tylko rola CLIENT)
    alt brak powiązania, e-mail zweryfikowany, klient o tym e-mailu bez keycloakSub
        API->>DB: UPDATE Customer SET keycloakSub = sub WHERE keycloakSub IS NULL (A1)
    else brak powiązania, e-mail zweryfikowany, brak klienta o tym e-mailu
        API->>DB: nowy klient + rachunek demonstracyjny (B-09)
    else brak e-maila, e-mail niezweryfikowany albo klient powiązany z innym sub
        API-->>A: 401 → komunikat, wylogowanie, brak danych (TL-04a)
    end
    API-->>A: 200 rachunki (saldo tylko w RAM, React Query)
    A-->>U: pulpit (klient) albo panel pracownika / administratora<br/>[docelowo P-10, etap 13] personel na telefonie: komunikat i wylogowanie
```

**Opis:**

- **Hasło, kod TOTP i klucz dostępu** trafiają wyłącznie do Keycloak w przeglądarce systemowej. Aplikacja dostaje tylko kod autoryzacyjny i wymienia go na tokeny z `code_verifier` (SR-01, T-04).
- **`state` sprawdza biblioteka** `expo-auth-session`. `nonce` dodaje etap 9.
- **API ufa wyłącznie podpisanemu tokenowi.** Powiązanie z klientem w banku powstaje tylko przez `keycloakSub` albo przy pierwszym logowaniu ze zweryfikowanym e-mailem (A1). Wynik dekodowania tokenu w aplikacji (principal) służy tylko do wyświetlania.

## 2. Odświeżenie tokenu przy 401 – [docelowo, etap 10]

```mermaid
sequenceDiagram
    autonumber
    participant S1 as Ekran (żądanie 1)
    participant S2 as Ekran (żądanie 2)
    participant H as Transport HTTP (http.ts)
    participant R as token-refresh (single-flight)
    participant K as Keycloak
    participant API as API S-Bank

    S1->>H: GET /accounts
    S2->>H: GET /accounts/{id}/transactions
    H->>API: oba żądania z wygasłym access tokenem
    API-->>H: 401
    API-->>H: 401
    H->>R: refresh() z żądania 1
    H->>R: refresh() z żądania 2 (czeka na to samo odświeżenie)
    R->>K: POST /token: grant_type=refresh_token, refresh_token, client_id=sbank-app
    alt refresh token ważny
        K-->>R: nowy access token, nowy refresh token (rotacja, stary unieważniony)
        R->>R: nadpisanie tokenów w RAM (na telefonie zapis do SecureStore dopiero przy przejściu w tło – P-09)
        R-->>H: true
        H->>API: ponowienie obu żądań z nowym tokenem (tylko raz)
        API-->>H: 200
        H-->>S1: dane
        H-->>S2: dane
    else invalid_grant (koniec sesji SSO, ubicie, ponowne użycie, wyłączenie konta)
        K-->>R: 400 invalid_grant
        R->>R: signOut lokalnie: RAM, wpis SecureStore, queryClient.clear()
        R-->>H: false
        H-->>S1: błąd sesji → ekran startowy
        H-->>S2: błąd sesji (bez drugiego odświeżenia)
    end
    opt 401 także po odświeżeniu
        H->>R: signOut lokalnie, ekran startowy (bez kolejnej próby)
    end
```

**Opis:**

- **Jedno odświeżenie na wiele żądań.** Gdyby każde żądanie odświeżało osobno, drugie użyłoby już unieważnionego refresh tokenu. Przy `refreshTokenMaxReuse 0` Keycloak unieważniłby wtedy całą sesję (TL-10).
- **Limit czasu żądania** to 15 s (etap 10).

## 3. Odblokowanie biometrią po ponownym uruchomieniu (telefon) – [docelowo, etap 11]

```mermaid
sequenceDiagram
    autonumber
    actor U as Użytkownik
    participant A as Aplikacja S-Bank
    participant AS as AsyncStorage
    participant SS as SecureStore (Keychain / Keystore)
    participant OS as System (biometria)
    participant K as Keycloak

    A->>AS: flaga „biometria włączona”? hasRunBefore?
    alt brak hasRunBefore (pierwszy start po instalacji)
        A->>SS: deleteItemAsync(refresh token), usunięcie pozostałości z Keychain (iOS)
        A->>AS: hasRunBefore = true
        A-->>U: ekran startowy (zwykłe logowanie)
    else flaga biometrii włączona
        A-->>U: stan locked: „Odblokuj biometrią”
        U->>A: naciska „Odblokuj biometrią”
        A->>SS: getItemAsync(refresh token, requireAuthentication)
        SS->>OS: monit Face ID / odcisk palca
        alt sukces
            OS-->>SS: potwierdzone
            SS-->>A: refresh token
            A->>K: POST /token: grant_type=refresh_token
            alt sesja SSO ważna
                K-->>A: nowe tokeny (rotacja)
                A->>A: tokeny w RAM, stan signedIn
                A-->>U: pulpit
            else invalid_grant
                K-->>A: 400 invalid_grant
                A->>SS: deleteItemAsync
                A-->>U: ekran startowy (zwykłe logowanie)
            end
        else anulowanie
            OS-->>A: anulowano
            A-->>U: ekran startowy, wpis zostaje do następnej próby (TL-17)
        else klucz unieważniony (zmiana biometrii)
            SS-->>A: null
            A->>SS: deleteItemAsync
            A->>AS: flaga biometrii = false
            A-->>U: ekran startowy (TL-18)
        end
    else flaga wyłączona
        A-->>U: ekran startowy
    end
```

**Opis:**

- **Tokeny w RAM:** access token nigdy nie trafia na dysk, a refresh token przetrwa restart tylko za zgodą na biometrię (SR-09).
- **Monit przy zapisie na Androidzie:** zapis do SecureStore z `requireAuthentication` też pokazuje monit (dokumentacja SDK 57). Dlatego zapis następuje raz, przy przejściu w tło, a nie po każdej rotacji (D17).

## 4. Step-up przy przelewie ≥ 1 000 zł

```mermaid
sequenceDiagram
    autonumber
    actor U as Klient
    participant A as Aplikacja S-Bank
    participant B as Przeglądarka systemowa
    participant K as Keycloak
    participant API as API S-Bank

    U->>A: formularz przelewu 1 250 zł
    A->>API: POST /transfers (odbiorca, kwota, tytuł)
    API-->>A: 201 projekt {id, requiresStepUp: true}
    A-->>U: ekran potwierdzenia projektu {id} + panel „Potwierdź kluczem dostępu”
    U->>A: „Potwierdź”
    alt acr=2 i auth_time nie starszy niż 300 s (isStepUpFresh)
        A->>A: step-up niepotrzebny
    else brak świeżego step-upu
        A->>B: GET /auth?…&acr_values=2, [docelowo, etap 9] &prompt=login&max_age=0
        B->>K: żądanie logowania LoA 2
        K->>U: WebAuthn – klucz dostępu
        U->>K: podpis kluczem
        K-->>B: 302 sbank://oauth/callback?code&state
        B-->>A: powrót
        A->>K: POST /token (code, code_verifier)
        K-->>A: tokeny z acr=2, auth_time=teraz
        A->>A: nowe tokeny w RAM (setOidcSession)
    end
    A->>API: POST /transfers/{ten sam id}/confirm
    API->>API: kwota ≥ SystemConfig.stepUpThreshold → acr === "2" i now − auth_time ≤ 300 s<br/>(brak auth_time = nieświeży, A2)
    alt warunek spełniony
        API-->>A: 200 wykonany, operationNumber, podpis ECDSA
        A-->>U: „Przelew wykonany”
    else warunek niespełniony (np. step-up sprzed 6 min)
        API-->>A: 403 {code: STEP_UP_REQUIRED} + wpis incydentu w AuditLog
        A-->>U: ponowny step-up i potwierdzenie tego samego projektu {id}
    end
```

**Opis:**

- **Potwierdzenie dotyczy identyfikatora projektu,** więc kwoty nie da się podmienić po step-upie (SR-07, T-05).
- **Krok aplikacji to tylko wygoda,** bo próg i świeżość sprawdza API. Płatność z linku lub QR (`POST /payment-requests/{id}/pay`) przechodzi przez tę samą kontrolę step-upu.
- **`prompt=login` i `max_age=0`** zmuszą Keycloak do ponownego użycia klucza, zamiast wydać tokeny z istniejącej sesji SSO (etap 9).

## 5. Wylogowanie

```mermaid
sequenceDiagram
    autonumber
    actor U as Użytkownik
    participant A as Aplikacja S-Bank
    participant SS as SecureStore / RAM
    participant B as Przeglądarka systemowa
    participant K as Keycloak

    U->>A: „Wyloguj”
    A->>A: zapamiętuje refresh token i ID token z bieżącego stanu
    A->>SS: session-store.signOut(): tokeny z RAM, deleteItemAsync(refresh token)
    A->>A: queryClient.clear() (rachunki, historia, profil)
    A-->>U: ekran startowy (od razu, bez czekania na sieć)
    A->>K: POST /revoke: token=refresh token, client_id=sbank-app
    K-->>A: 200 (błąd sieci ignorowany, sesja lokalna już zamknięta)
    A->>B: GET /logout?client_id=sbank-app&post_logout_redirect_uri=sbank://oauth/callback&id_token_hint
    B->>K: koniec sesji SSO, ciasteczka KEYCLOAK_* usunięte
    K-->>B: 302 post_logout_redirect_uri
    B-->>A: powrót
    Note over A,K: [docelowo, etap 11] także usunięcie flagi biometrii z AsyncStorage
```

**Opis:**

- **Kolejność jak w `SessionProvider.signOut`:** najpierw czyszczenie lokalne, potem wylogowanie w Keycloak. Nawet bez sieci w aplikacji nie zostają tokeny ani dane finansowe.
- **Po wylogowaniu stary refresh token daje `invalid_grant`,** a w konsoli Keycloak nie ma sesji (TL-07).

## 6. Ubicie sesji przez administratora i okno do wygaśnięcia access tokenu

```mermaid
sequenceDiagram
    autonumber
    actor ADM as Administrator realmu sbank
    participant K as Keycloak
    participant A as Aplikacja S-Bank (klient)
    participant API as API S-Bank

    Note over A: sesja aktywna, access token wydany o T0 (exp = T0 + 5 min)
    ADM->>K: konsola → Users → użytkownik → Sessions → Sign out (T1)
    K->>K: usunięcie sesji SSO i refresh tokenów użytkownika
    A->>API: GET /accounts z access tokenem (T1 < t < T0 + 5 min)
    API->>API: lokalna weryfikacja JWT: podpis i exp OK (bez pytania Keycloak)
    API-->>A: 200 – okno do 5 min (D9, TL-09)
    Note over A,API: po exp
    A->>API: GET /accounts
    API-->>A: 401 (token wygasł)
    A->>K: POST /token: grant_type=refresh_token
    K-->>A: 400 invalid_grant (sesja ubita)
    A->>A: signOut lokalnie: RAM, SecureStore, queryClient.clear()
    A-->>A: ekran startowy, wymagane nowe logowanie (TL-08)
```

**Opis:**

- **Okno do 5 min:** API nie pyta Keycloak przy każdym żądaniu (D9), więc ubity użytkownik działa jeszcze najwyżej do `exp`.
- **To samo dotyczy** wyłączenia konta (TL-11) i odebrania roli (TL-12): zmiana zadziała przy najbliższym odświeżeniu.
- **Natychmiastowe odcięcie** wymagałoby introspekcji tokenu w API, czyli zmiany architektury.

## 7. Pierwsze logowanie pracownika / administratora (D16)

```mermaid
sequenceDiagram
    autonumber
    actor P as Pracownik (komputer, web)
    participant A as Aplikacja S-Bank (web)
    participant K as Keycloak
    participant API as API S-Bank

    P->>A: „Zaloguj się hasłem”
    A->>K: /auth?acr_values=1 (PKCE)
    K->>P: login + hasło tymczasowe
    P->>K: dane logowania
    K->>P: UPDATE_PASSWORD – nowe hasło (polityka: 12 znaków …)
    K->>P: webauthn-register-passwordless – rejestracja klucza (Windows Hello, klucz sprzętowy, wirtualny autentykator Chrome)
    P->>K: nowy klucz dostępu
    K-->>A: kod → tokeny z acr=1 (przepływ LoA 1)
    A->>API: GET /customers
    API-->>A: 403 PASSKEY_REQUIRED (rola EMPLOYEE bez acr=2)
    A-->>P: [docelowo, etap 9] „Zaloguj się kluczem dostępu”
    P->>A: „Zaloguj się kluczem dostępu”
    A->>K: /auth?acr_values=2
    K->>P: WebAuthn
    P->>K: podpis nowym kluczem
    K-->>A: kod → tokeny z acr=2
    A->>API: GET /customers
    API-->>A: 200 – panel pracownika
```

**Opis:**

- **Potwierdzone w etapie 7 (2026-11-26), po P-13.** Pracownik, który ma już klucz, nie może zalogować się hasłem: podprzepływ `Deny access` pokazuje „Pracownik i administrator logują się kluczem dostępu.”
- **Administrator przechodzi tę samą drogę** z rolą `admin` i trasą `/users`.
