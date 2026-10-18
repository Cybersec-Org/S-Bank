# Diagramy – S-Bank

Schemat działania aplikacji, architektura i przebieg najważniejszej operacji. Kod Mermaid poniżej GitHub wyświetla jako diagram; te same diagramy są w plikach PNG obok.

## 1. Schemat działania aplikacji

Droga użytkownika od uruchomienia aplikacji: funkcje publiczne, rejestracja i logowanie, rozdział według roli i przebieg płatności. Elementy pomarańczowe to punkty kontroli bezpieczeństwa, zielone – funkcje dostępne bez logowania.

![Schemat działania](1-schemat-dzialania.png)

```mermaid
flowchart TD
  start([Użytkownik otwiera S-Bank<br/>telefon lub przeglądarka]) --> zal{Ma aktywną sesję?}
  zal -- nie --> gosc[Ekran startowy]
  zal -- tak --> bio[Odblokowanie biometrią]
  gosc --> kursy[Kursy walut NBP i przelicznik<br/>bez logowania]
  gosc --> rej[Rejestracja w Keycloak<br/>potwierdzenie e-maila]
  gosc --> log[Logowanie OIDC + PKCE<br/>hasło lub klucz dostępu]
  rej --> log
  log --> rola{Rola w tokenie}
  bio --> rola
  rola -- klient --> pulpit[Pulpit<br/>rachunki, saldo, ostatnie operacje]
  rola -- pracownik --> panelP[Panel pracownika<br/>podgląd, blokada rachunku, limit]
  rola -- administrator --> panelA[Panel administratora<br/>role, partnerzy API, dziennik audytowy]
  pulpit --> hist[Historia operacji]
  pulpit --> odb[Odbiorcy]
  pulpit --> prz[Nowy przelew]
  pulpit --> qr[Płatność z kodu QR lub linku<br/>dane żądania pobrane z API]
  partner[System partnera<br/>API z mTLS] -. tworzy żądanie płatności .-> qr
  prz --> prog{Kwota od 1 000 zł?}
  qr --> prog
  prog -- tak --> stepup[Step-up<br/>potwierdzenie kluczem dostępu]
  prog -- nie --> wyk
  stepup --> wyk[API sprawdza saldo i limit<br/>w jednej transakcji i księguje]
  wyk --> pdf[Potwierdzenie przelewu<br/>podpisane kluczem z HSM]
  classDef sec fill:#FFF1DC,stroke:#9A5200,color:#4A2800
  classDef pub fill:#E1EEE9,stroke:#0E5A47,color:#10201C
  class log,stepup,bio,wyk,pdf sec
  class kursy,gosc,rej pub
```

## 2. Architektura i przepływ danych

Komponenty, granice zaufania i protokoły między nimi. Z internetu dostępny jest tylko Caddy; API, Keycloak, bazy i HSM działają w sieci wewnętrznej.

![Architektura](2-architektura.png)

```mermaid
flowchart LR
  subgraph U["Strefa użytkownika (niezaufana)"]
    app["Aplikacja mobilna<br/>React Native / Expo"]
    web["Wersja web<br/>react-native-web"]
    br["Przeglądarka systemowa<br/>strony logowania"]
  end
  subgraph P["Partner (zewnętrzny)"]
    sys["System sklepu<br/>z certyfikatem klienta"]
  end
  subgraph S["Serwer S-Bank – Docker Compose"]
    caddy["Caddy<br/>TLS 1.3, mTLS dla /partner,<br/>limity zapytań, nagłówki"]
    subgraph INT["Sieć wewnętrzna (bez dostępu z internetu)"]
      api["Własne API<br/>NestJS: JWT, CASL, walidacja, audyt"]
      kc["Keycloak<br/>OIDC, passkeys, role, step-up"]
      db[("PostgreSQL<br/>rachunki, transakcje, audyt")]
      kcdb[("PostgreSQL<br/>dane Keycloak")]
      hsm["SoftHSM2<br/>klucze nieeksportowalne"]
      mail["Mailpit<br/>e-maile testowe"]
    end
  end
  nbp["NBP Web API<br/>kursy walut"]
  app -- "HTTPS + Bearer JWT" --> caddy
  web -- "HTTPS + Bearer JWT" --> caddy
  br -- "OIDC + PKCE" --> caddy
  sys -- "mTLS + token związany z certyfikatem" --> caddy
  caddy -- "/api, /public, /partner" --> api
  caddy -- "/auth" --> kc
  api -- "SQL (Prisma)" --> db
  api -- "klucze publiczne JWKS" --> kc
  api -- "PKCS#11" --> hsm
  api -- "HTTPS, timeout, cache" --> nbp
  kc --> kcdb
  kc -- "SMTP" --> mail
  style U fill:#FFF7F5,stroke:#B4442A
  style P fill:#FFF7F5,stroke:#B4442A
  style S fill:#F3F6F4,stroke:#0E5A47
  style INT fill:#E1EEE9,stroke:#0E5A47
```

## 3. Przelew z dodatkowym potwierdzeniem (step-up)

Przebieg podstawowej czynności – przelewu od 1 000 zł: logowanie OIDC z PKCE, projekt przelewu zapisany na serwerze, potwierdzenie kluczem dostępu, sprawdzenie poziomu `acr` przez API, księgowanie w jednej transakcji, podpis potwierdzenia w HSM i wpis w dzienniku audytowym.

![Przebieg przelewu](3-przelew-sekwencja.png)

```mermaid
sequenceDiagram
  autonumber
  actor K as Klient
  participant A as Aplikacja S-Bank
  participant KC as Keycloak
  participant API as Własne API
  participant DB as PostgreSQL
  participant H as SoftHSM (HSM)
  K->>A: Logowanie
  A->>KC: Authorization Code + PKCE w przeglądarce systemowej
  KC-->>A: Tokeny: access (5 min) i refresh
  K->>A: Przelew 1 250 zł
  A->>API: POST /api/transfers (Bearer, klucz idempotencji)
  API->>API: Walidacja danych, rola, właściciel rachunku
  API->>DB: Zapis projektu przelewu
  API-->>A: 201: projekt zapisany, wymagany step-up
  A->>KC: Ponowne uwierzytelnienie z acr_values (wysoki poziom)
  KC->>K: Potwierdź kluczem dostępu (biometria)
  KC-->>A: Nowy token z acr = 2
  A->>API: POST /api/transfers/{id}/confirm
  API->>API: Sprawdzenie acr i auth_time w tokenie
  API->>DB: Transakcja: blokada rachunku, saldo, limit, księgowanie
  API->>H: Podpis potwierdzenia przez PKCS#35;11 (klucz nie opuszcza HSM)
  H-->>API: Podpis
  API->>DB: Wpis w dzienniku audytowym
  API-->>A: Przelew wykonany + podpisane potwierdzenie
```
