# S-Bank – mapowanie ekranów aplikacji na API (etap 2, punkt kontrolny)

Stan na 2026-11-05. Źródłem prawdy jest kod w `api/` (NestJS 12, Prisma 6, SQLite), odczytany bez uruchamiania API i bez żadnych zmian w jego kodzie.

## 1. Co faktycznie robi API

| Temat | Stan w kodzie |
| --- | --- |
| Framework, port | NestJS 12 (ESM), `PORT` albo 3000. Bez prefiksu ścieżek (nie ma `/api`). |
| Uruchomienie | `api/RUNME.sh`: `.env` z `DATABASE_URL="file:./dev.db"`, migracja, `prisma generate`, seed (`prisma/seed.ts`), `pnpm run dev`. |
| Kontrakt | Brak pliku `openapi.json`. Swagger działa na żywo: `GET /docs` (UI), JSON pod `/docs-json`. Skrypt `app:api:types` w aplikacji czyta `../api/openapi.json`, którego nie ma. W `api/package.json` nie ma też skryptów, do których odwołuje się główny `package.json` (`openapi:generate`, `db:seed`, `test:e2e` i inne). |
| CORS | `app.enableCors()` bez ograniczeń (każdy origin). |
| **Uwierzytelnianie** | **Nie ma.** `MockAuthGuard` bierze tożsamość z nagłówków `x-user-id` (domyślnie `client-1`) i `x-user-role` (`CLIENT`/`EMPLOYEE`/`ADMIN`, domyślnie `CLIENT`). Brak JWT, Keycloaka, OIDC, sesji, refresh tokenu, `acr`, step-up. Każdy może podać `x-user-role: ADMIN`. |
| Autoryzacja | CASL: klient widzi i zmienia tylko swoje konta (`ownerId`), pracownik czyta wszystko i może zamrażać konta, nie może przelewać, admin może wszystko. Próby BOLA trafiają do `AuditLog`. |
| Kwoty | **Liczby dziesiętne w złotych** (np. `150.5`), nie grosze. Dotyczy `balance`, `dailyLimit`, `amount`. |
| Daty | ISO 8601 (`createdAt`, `updatedAt`). |
| Błędy | Domyślny format Nest: `{ "statusCode", "message", "error" }`. Brak pola `code`, brak problem+json, brak pól walidacji w formie mapowalnej na formularz. Nie ma 401 (guard nigdy go nie rzuca poza błędną rolą), nie ma 409, 429. Przelew: brak środków i przekroczony limit to **403**, nie 422. |
| Idempotencja | Brak nagłówka `Idempotency-Key`. |

## 2. Endpointy, które istnieją

| Metoda i ścieżka | Kto | Ciało / parametry | Odpowiedź |
| --- | --- | --- | --- |
| `GET /health` | publiczny | – | `{status, timestamp}` |
| `GET /public/rates` | publiczny | – | `{source, effectiveDate, rates:[{code, currency (nazwa po angielsku), mid (liczba)}]}`; zawiera `PLN` z kursem 1; brak numeru tabeli |
| `GET /public/convert` | publiczny | `amount`, `from`, `to` | `{amount, fromCurrency, toCurrency, convertedAmount, exchangeRate, effectiveDate}` |
| `GET /accounts` | klient: własne; pracownik i admin: **wszystkie** | – | `[{id, iban, ownerId, name, currency, balance, dailyLimit, status (ACTIVE/FROZEN/CLOSED), createdAt, updatedAt}]` |
| `GET /accounts/:id` | właściciel, pracownik, admin | – | jak wyżej, 404 / 403 |
| `GET /accounts/:id/transactions` | jw. | – (brak filtrów i stronicowania) | `[{id, senderAccountId, receiverAccountId, senderIban, receiverIban, receiverName, amount, currency, title, type, status, createdAt, direction (INCOMING/OUTGOING)}]` |
| `POST /accounts/:id/transactions` | tylko właściciel aktywnego konta | `{receiverIban (28 znaków), receiverName, amount (>0), title}` | utworzona transakcja; **wykonuje się od razu**, odbiorca musi mieć konto w tym banku (inaczej 404) |
| `PATCH /accounts/:id/limit` | **tylko właściciel** (CASL `Update`; pracownik nie ma tego prawa) | `{newLimit}` | konto |
| `PATCH /accounts/:id/status` | pracownik, admin | `{status: ACTIVE\|FROZEN\|CLOSED}` | konto |
| `GET /accounts/admin/audit-logs` | admin | – | ostatnie 100 wpisów `{id, actorId, actorRole, action, resourceId, details, ipAddress, createdAt}` |

## 3. Tabela mapowania

Status: **gotowe** = da się podłączyć bez zmian w API (z przeliczeniem w mapperze), **niezgodne** = istnieje, ale kontrakt istotnie różni się od potrzeb ekranu, **brak** = nie ma odpowiednika.

| Ekran / akcja | Interfejs w aplikacji | Endpoint w API | Różnice względem modelu aplikacji | Status |
| --- | --- | --- | --- | --- |
| Logowanie, sesja, profil (imię i nazwisko, rola) | `SessionStore`, `useSession` | brak (tylko nagłówki `x-user-id`, `x-user-role`) | Brak tokenów, OIDC, `acr`, wylogowania po stronie serwera. Brak endpointu z imieniem i nazwiskiem. Nagłówki może ustawić każdy klient. | **brak** |
| Pulpit: lista rachunków, saldo | `AccountsRepository.listAccounts` | `GET /accounts` | Kwoty w zł (mapper ×100 do groszy). `status` `ACTIVE/FROZEN/CLOSED` zamiast `active/blocked`. IBAN pełny (aplikacja maskuje). Nazwa konta po angielsku (`Personal Account PLN`). Są konta walutowe (`EUR`), aplikacja zakłada PLN. | gotowe (z mapperem) |
| Pulpit: limit dzienny i „wykorzystanie dziś” | pole `dailyUsedGrosze` | `dailyLimit` z `GET /accounts` | **Brak informacji o wykorzystaniu limitu dziś.** Serwer porównuje limit z kwotą pojedynczego przelewu, nie z sumą dnia. Pasek „Limit dzienny po tym przelewie” nie ma danych. | **niezgodne** |
| Ostatnie operacje, historia | `listTransactions(accountId, query)` | `GET /accounts/:id/transactions` | Brak filtrów po dacie i rodzaju (filtrować trzeba w aplikacji, serwer zwraca wszystko, bez stronicowania). Brak pola „nazwa kontrahenta” dla wpływów (`receiverName` to zawsze odbiorca). Brak rozróżnienia „płatność z QR / z linku” (jest `type`: `INTERNAL_TRANSFER`, `EXTERNAL_TRANSFER`, `DEPOSIT`). Opis na liście to `title`. | **niezgodne** |
| Nowy przelew: projekt przelewu | `TransfersRepository.createDraft` | brak | API nie ma projektu przelewu ani odczytu po id. `POST /accounts/:id/transactions` wykonuje przelew od razu. | **brak** |
| Potwierdzenie przelewu, step-up (≥ 1 000 zł) | `getDraft`, `confirmDraft`, `requiresStepUp` | `POST /accounts/:id/transactions` (wykonanie) | Brak potwierdzenia, progu 1 000 zł, `acr`, klucza dostępu i idempotencji. Odbiorca musi być klientem tego banku (nie ma przelewów zewnętrznych). Błędy: 403 zamiast 422. | **brak** (wykonanie jest, potwierdzenie nie) |
| Anulowanie projektu przelewu | `cancelDraft` | brak | – | **brak** |
| Potwierdzenie podpisane przez bank | – | brak | Odpowiedź przelewu nie jest podpisana ani nie ma numeru operacji. | **brak** |
| Żądanie płatności: pobranie, zatwierdzenie, odrzucenie (QR, link) | `PaymentsRepository` | brak | Cały moduł płatności partnerów nie istnieje. | **brak** |
| Kursy walut (bez logowania) | `RatesRepository.getRatesTable` | `GET /public/rates` | Kurs jako liczba zmiennoprzecinkowa (mapper ×10 000 do liczby całkowitej). Nazwy walut po angielsku (aplikacja pokazuje „euro”, „dolar amerykański”, więc nazwy trzeba mapować po stronie aplikacji). Brak numeru tabeli (`196/A/NBP/2026`). Lista zawiera wszystkie waluty NBP i `PLN`, aplikacja pokazuje 5. | gotowe (z mapperem; bez numeru tabeli) |
| Przelicznik walut | konwersja lokalna | `GET /public/convert` (opcjonalnie) | Aplikacja liczy lokalnie na kursach średnich (spójnie z serwerem). Endpoint niepotrzebny. | gotowe |
| Panel pracownika: wyszukiwanie klienta | `EmployeeRepository.searchCustomers` | brak | Nie ma encji klienta (imię, nazwisko, e-mail, numer klienta). Pracownik widzi tylko `GET /accounts` (wszystkie konta, z samym `ownerId`). | **brak** |
| Panel pracownika: rachunki i historia klienta | `getCustomerDetails` | `GET /accounts` (filtr po `ownerId` w aplikacji) + `GET /accounts/:id/transactions` | Da się złożyć widok „konta i historia” dla `ownerId`, ale bez danych osobowych. Odczyt przez pracownika nie zapisuje wpisu w dzienniku audytowym (aplikacja i makieta obiecują zapis). | **niezgodne** |
| Panel pracownika: zmiana limitu | `setDailyLimit` | `PATCH /accounts/:id/limit` | **Pracownik dostaje 403** (CASL pozwala na `Update` tylko właścicielowi i adminowi). Brak zakresu dozwolonych wartości po stronie serwera. | **niezgodne** |
| Panel pracownika: blokada / odblokowanie | `setAccountBlocked` | `PATCH /accounts/:id/status` | Działa dla pracownika i admina. `FROZEN` ↔ `blocked`, `ACTIVE` ↔ `active`. | gotowe (z mapperem) |
| Zapisani odbiorcy | `RecipientsRepository` | brak | – | **brak** |
| Profil: biometria, klucze dostępu | `SettingsRepository` | brak | – | **brak** |
| Bankomaty | `AtmsRepository` | brak | – | **brak** (w etapie 1 i tak „wkrótce”) |
| Admin: użytkownicy, partnerzy | `AdminRepository` | brak | – | **brak** |
| Admin: dziennik audytowy | `AdminRepository` | `GET /accounts/admin/audit-logs` | Inny kształt wpisu (`action` to dowolny napis, `details` to tekst JSON). Tylko 100 ostatnich. | niezgodne (drobne) |

## 4. Wniosek i zatrzymanie

Reguła z etapu 2: jeśli ekran nie ma odpowiednika w API albo kontrakt istotnie się różni, zatrzymuję się i czekam na decyzję. Tutaj dotyczy to większości aplikacji.

**Da się podłączyć teraz (po stronie aplikacji, bez zmian w API):** lista kont i saldo, historia (z filtrowaniem lokalnym), kursy walut, blokada i odblokowanie konta przez pracownika.

**Wymaga decyzji:**

1. **Uwierzytelnianie.** API nie ma prawdziwego logowania, tylko nagłówki do podszywania się pod dowolną rolę. Aplikacja z etapu 1 zakłada OIDC (Keycloak) i tokeny. Dopóki tego nie ma, logowanie „kluczem dostępu” nie może działać, a podpięcie nagłówków do aplikacji (`x-user-role: ADMIN` wpisane w kliencie) byłoby zaprzeczeniem zasad z doc (rola z tokenu, a nie z klienta).
2. **Przelew.** Aplikacja ma dwa kroki (projekt i potwierdzenie, step-up od 1 000 zł, idempotencja). API ma jeden krok bez zabezpieczeń.
3. **Płatności z QR i linku**, **odbiorcy**, **ustawienia/klucze**, **bankomaty**, **wyszukiwanie klientów** i **limit dzienny wykorzystany dziś**: brak w API.
4. **Format danych:** zł zamiast groszy, błędy bez kodów, brak `openapi.json`.

## 5. Propozycje (do wyboru, osobno dla każdego punktu)

| Opcja | Co to znaczy | Koszt |
| --- | --- | --- |
| **A. Tryb hybrydowy (rekomendowana na teraz)** | Aplikacja używa API tam, gdzie ono istnieje (konta, historia, kursy, blokada konta), a pozostałe funkcje zostają na mocku (`EXPO_PUBLIC_DATA_SOURCE=api\|mock` per repozytorium). Logowanie: tymczasowo wybór demonstracyjnej tożsamości, wysyłanej w nagłówkach `x-user-id` / `x-user-role` **wyłącznie w trybie deweloperskim**, z wyraźnym oznaczeniem w UI. Bez zmian w API. | ok. 1 dzień |
| **B. Dopasować API do aplikacji** | Osobne zadania w API (skill `new-endpoint`): JWT/OIDC, projekt i potwierdzenie przelewu z `acr`, żądania płatności, klienci i wyszukiwanie, kategoria operacji, wykorzystanie limitu, pracownik może zmieniać limit, format błędów z `code`, wygenerowany `openapi.json`. Wymaga Twojej wyraźnej zgody na zmiany w kodzie API. | kilka dni, poza zakresem aplikacji |
| **C. Dopasować aplikację do API** | Przelew w jednym kroku (bez step-up i projektu), usunięcie ekranów bez odpowiednika (płatności QR, odbiorcy, klucze, wyszukiwanie klientów), kwoty w zł. Aplikacja traci większość funkcji z wymagań. | ok. 1–2 dni, ale cofa wymagania |

Do Twojej decyzji pozostają dwie rzeczy:

1. Którą opcję wybierasz (A, B, C albo mieszankę, np. A teraz i B jako kolejne zadania).
2. Czy przy opcji A dopuszczasz tymczasowe wysyłanie `x-user-id` / `x-user-role` z aplikacji w trybie deweloperskim, czy wolisz poczekać na prawdziwe uwierzytelnianie w API.

Do czasu odpowiedzi nie piszę klienta HTTP ani nie zmieniam `src/data` / repozytoriów aplikacji.
