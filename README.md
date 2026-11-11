# S-Bank

Uproszczona aplikacja bankowa (web i mobile), zbudowana w celu praktycznej demonstracji poprawnie skonfigurowanych mechanizmów bezpieczeństwa w nowoczesnych aplikacjach webowych i mobilnych.

## Członkowie zespołu

| Imię i nazwisko | Główna odpowiedzialność |
| :--- | :--- |
| **Michał Pokrzywa** | Aplikacja (React Native / Expo – mobile i web) |
| **Mateusz Falfus** | Backend API (NestJS), logika biznesowa i baza danych |
| **Kacper Sikorski** | Tożsamość (Keycloak), infrastruktura Docker i CI/CD |

## Wybrany język i technologie

W całym projekcie będzie wykorzystywany język **TypeScript**.

| Część | Technologie |
| :--- | :--- |
| **Aplikacja (web, Android, iOS)** | React Native + Expo, react-native-web |
| **Backend – własne API** | Node.js + NestJS, REST API z dokumentacją OpenAPI (Swagger) |
| **Baza danych** | PostgreSQL + Prisma ORM |
| **Logowanie i tożsamość** | Keycloak |
| **Infrastruktura** | Docker Compose, Caddy |
| **CI/CD i bezpieczeństwo kodu** | GitHub Actions, CodeQL, Dependabot |
| **Zewnętrzne API** | NBP Web API – pobieranie aktualnych kursów walut |

## Krótki opis

S-Bank pozwala użytkownikowi założyć konto, bezpiecznie się zalogować, sprawdzić saldo oraz historię operacji, wykonać tradycyjny przelew lub szybką płatność kodem QR, a także przeliczyć kwotę po aktualnych kursach NBP. Z systemu korzystają klienci banku, pracownicy obsługi klienta (posiadający wgląd w dane w trybie tylko do odczytu) oraz administratorzy zarządzający kontami i limitami transakcyjnymi.

Główną funkcjonalnością w aplikacji jest bezpieczny przelew z własnego rachunku, serwer weryfikuje uprawnienia, stan konta oraz dzienny limit operacji, a przelewy powyżej określonej kwoty (np. 1 000 zł) wymagają dodatkowego potwierdzenia kluczem dostępu (Passkey). Główny nacisk położono na mechanizmy ochrony: uwierzytelnianie OIDC z PKCE, kontrolę dostępu po stronie serwera, bezpieczne przechowywanie sesji i ochronę ekranu na urządzeniu mobilnym, szyfrowanie ruchu oraz automatyczną analizę bezpieczeństwa kodu i kontenerów w CI/CD.

---

## Wymagania środowiskowe

* **Docker** (w wersji `>= 24.0`) oraz **Docker Compose** (w wersji `>= 2.20`)
* **Node.js** (w wersji `>= 20.x` LTS)
* **pnpm** (w wersji `>= 9.x`, np. przez `corepack enable`)

---

## Sposób instalacji

1. Sklonuj repozytorium projektu na dysk lokalny:
   ```bash
   git clone DSO-main https://github.com/Cybersec-Org/S-Bank
   cd S-Bank
   ```

2. Wszystkie pakiety, plik konfiguracyjny `.env` oraz tabele w bazie danych PostgreSQL tworzone są automatycznie podczas uruchomienia skryptu startowego.

---

## Sposób uruchomienia

Zalecanym sposobem uruchomienia projektu jest wykonanie skryptu **`RUNME.sh`** znajdującego się w głównym katalogu repozytorium:

```bash
./RUNME.sh
```

Skrypt automatycznie skonfiguruje środowisko (`.env`), uruchomi bazę danych PostgreSQL w kontenerze Docker, utworzy tabele i wypełni je danymi startowymi (`seed.ts`), a następnie podniesie serwer API oraz odpali aplikację (`app`).

---

## Adres aplikacji

* **Backend API:** `http://localhost:3000`
* **Endpoint statusu aplikacji (Healthcheck):** `http://localhost:3000/health`
* **Dokumentacja OpenAPI (Swagger UI):** `http://localhost:3000/api`
* **Aplikacja webowa / Expo:** `http://localhost:8081`

---

## Opis endpointów

| Metoda | Ścieżka | Opis endpointu |
| :--- | :--- | :--- |
| `GET` | `/health` | Sprawdza, czy aplikacja jest uruchomiona i zwraca odpowiedni status (`200 OK`). |
| `GET` | `/public/rates` | Pobiera aktualną tabelę średnich kursów walut z zewnętrznego API NBP. |
| `GET` | `/public/convert` | Przelicza podaną kwotę (`amount`) pomiędzy wybranymi walutami (`from`, `to`). |
| `GET` | `/accounts` | Zwraca listę rachunków bankowych wraz z saldem, limitem dziennym i kwotą wykorzystaną danego dnia (`dailyUsed`). |
| `GET` | `/accounts/audit-logs` | Zwraca dziennik audytowy bezpieczeństwa z zarejestrowanymi zdarzeniami. |
| `GET` | `/accounts/{id}` | Zwraca szczegóły pojedynczego rachunku bankowego na podstawie jego identyfikatora. |
| `GET` | `/accounts/{id}/transactions` | Zwraca historię zrealizowanych transakcji dla wskazanego rachunku. |
| `PATCH` | `/accounts/{id}/limit` | Zmienia dzienny limit operacji na wskazanym rachunku bankowym. |
| `PATCH` | `/accounts/{id}/status` | Zmienia status rachunku bankowego (`ACTIVE`, `FROZEN`, `CLOSED`). |
| `POST` | `/transfers` | **Krok 1 przelewu:** Waliduje stan konta oraz limit dzienny i tworzy szkic przelewu (`DRAFT`). |
| `POST` | `/transfers/{id}/confirm` | **Krok 2 przelewu:** Zatwierdza szkic przelewu i wykonuje transfer środków pomiędzy rachunkami (`COMPLETED`). |
| `POST` | `/transfers/{id}/cancel` | **Krok 2 (alternatywny):** Anuluje utworzony wcześniej szkic przelewu (`CANCELLED`). |
| `GET` | `/customers/me` | Zwraca profil zalogowanego klienta wraz z jego rachunkami i historią transakcji. |
| `GET` | `/customers` | Wyszukuje klientów po imieniu, nazwisku, adresie e-mail lub numerze klienta (`?query=`). |
| `GET` | `/customers/{id}` | Zwraca szczegółowe dane wskazanego klienta wraz z rachunkami i historią operacji. |

---

## Przykładowe żądania

### 1. Sprawdzenie czy aplikacja jest uruchomiona (`GET /health`)
**Żądanie:**
```bash
curl -i -X GET http://localhost:3000/health
```
**Odpowiedź (`200 OK`):**
```json
{
  "status": "ok",
  "timestamp": "2026-11-11T21:57:56.684Z"
}
```

### 2. Przeliczenie kwoty po aktualnym kursie NBP (`GET /public/convert`)
**Żądanie:**
```bash
curl -X GET "http://localhost:3000/public/convert?amount=100&from=PLN&to=EUR"
```
**Odpowiedź (`200 OK`):**
```json
{
  "amount": 100,
  "fromCurrency": "PLN",
  "toCurrency": "EUR",
  "convertedAmount": 22.78,
  "exchangeRate": 0.2278,
  "effectiveDate": "2026-11-10"
}
```

### 3. Pobranie profilu, rachunków i historii operacji zalogowanego klienta (`GET /customers/me`)
**Żądanie:**
```bash
curl -X GET http://localhost:3000/customers/me \
  -H "x-user-id: client-1" \
  -H "x-user-role: CLIENT"
```
**Odpowiedź (`200 OK`):**
```json
{
  "id": "client-1",
  "firstName": "Jan",
  "lastName": "Kowalski",
  "email": "jan.kowalski@example.com",
  "customerNumber": "CUST-1001",
  "accounts": [
    {
      "id": "e9ba1e61-dda3-46e4-84e8-efe9a3bb87ef",
      "iban": "PL11102010260000140202736451",
      "ownerId": "client-1",
      "currency": "PLN",
      "balance": 5000,
      "dailyLimit": 2000,
      "status": "ACTIVE",
      "createdAt": "2026-11-11T21:57:44.280Z",
      "updatedAt": "2026-11-11T21:57:44.280Z",
      "dailyUsed": 250
    },
    {
      "id": "57380ccc-877d-45e0-a162-525779fc79f6",
      "iban": "PL22102010260000140202736452",
      "ownerId": "client-1",
      "currency": "EUR",
      "balance": 1200.5,
      "dailyLimit": 500,
      "status": "ACTIVE",
      "createdAt": "2026-11-11T21:57:44.283Z",
      "updatedAt": "2026-11-11T21:57:44.283Z",
      "dailyUsed": 0
    }
  ],
  "transactions": [
    {
      "id": "a7b4ac9f-ec52-43e7-b3ce-dd2a01fc4629",
      "operationNumber": "OP-SEED-001",
      "senderAccountId": "e9ba1e61-dda3-46e4-84e8-efe9a3bb87ef",
      "receiverAccountId": "2e8c80ff-150a-4f2a-9ea5-960496541a19",
      "receiverIban": "PL99102010260000140202736451",
      "receiverName": "Anna Nowak",
      "amount": 250,
      "currency": "PLN",
      "title": "Initial seed transfer",
      "status": "COMPLETED",
      "createdAt": "2026-11-11T21:57:44.287Z",
      "executedAt": "2026-11-11T21:57:44.286Z"
    }
  ]
}
```