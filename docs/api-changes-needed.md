# S-Bank – co dorobić i poprawić w API, żeby działało z istniejącym frontem

Stan na 2026-11-08. Lista wynika z `docs/frontend-api-mapping.md`. To tylko lista; w kodzie API nic nie zmieniono.
Priorytety: **P0** = bez tego front nie działa na API, **P1** = brakuje funkcji ekranu, **P2** = jakość i porządek.

## P0 – bez tego front nie ruszy

| # | Zadanie | Dlaczego front tego potrzebuje |
| --- | --- | --- |
| 1 | **Prawdziwe uwierzytelnianie.** JWT/OIDC (Keycloak) zamiast nagłówków `x-user-id` i `x-user-role`. W tokenie: `sub`, rola, `acr`. Odpowiedzi 401 dla braku tokenu. | `SessionStore` oczekuje tokenu i poziomu `acr`. Dziś każdy może wpisać `x-user-role: ADMIN`. Rola ma pochodzić z tokenu, nie z klienta. |
| 2 | **Endpoint profilu** (np. `GET /me`): `{id, firstName, lastName, role}`. | Pulpit pokazuje imię i nazwisko, panel pracownika nazwę zalogowanego. API nie ma tych danych (model `Account` ma tylko `ownerId`). |
| 3 | **Przelew w dwóch krokach.** `POST /transfers` (projekt) → `GET /transfers/:id` → `POST /transfers/:id/confirm` (nagłówek `Idempotency-Key`) → `DELETE`/`POST .../cancel`. Projekt zwraca `requiresStepUp`. | Ekran przelewu: formularz, potwierdzenie, anulowanie. Dziś jest jeden `POST /accounts/:id/transactions`, który wykonuje się od razu. |
| 4 | **Step-up od 1 000 zł po stronie serwera.** Potwierdzenie kwoty ≥ 1 000 zł wymaga `acr` wysokiego poziomu, inaczej błąd z kodem (np. `STEP_UP_REQUIRED`). | Front wysyła użytkownika do klucza dostępu i próbuje ponownie. Serwer musi to egzekwować, nie front. |
| 5 | **Idempotencja** na potwierdzeniu przelewu i zatwierdzeniu płatności: ten sam klucz zwraca ten sam wynik, bez drugiego obciążenia. | Front generuje jeden klucz na zamiar użytkownika i powtarza go przy ponowieniu. |
| 6 | **Ujednolicony format błędów**: `{code, message, fieldErrors?}` (najlepiej problem+json). Kody m.in.: `INSUFFICIENT_FUNDS`, `DAILY_LIMIT_EXCEEDED`, `STEP_UP_REQUIRED`, `RECIPIENT_NOT_FOUND`, `ACCOUNT_BLOCKED`, `PAYMENT_EXPIRED`, `VALIDATION_FAILED`. | Front mapuje kody na komunikaty z `pl.ts`. Dziś jest `{statusCode, message, error}`, a brak środków i przekroczony limit to 403 zamiast 422. |
| 7 | **Wygenerowany `openapi.json`** w repo (skrypt w `api/package.json`) i poprawione skrypty w głównym `package.json` (`openapi:generate`, `db:seed`, `test:e2e` wskazują na nieistniejące skrypty). | Klient w aplikacji ma być generowany z kontraktu (`app:api:types` czyta `../api/openapi.json`, którego nie ma). |

## P1 – brakujące funkcje ekranów

| # | Zadanie | Ekran |
| --- | --- | --- |
| 8 | **Wykorzystanie limitu dziennego**: pole `dailyUsed` na koncie (suma wychodzących dziś) i sprawdzanie limitu jako suma dnia, nie kwota pojedynczego przelewu. | Pulpit i pasek „Limit dzienny po tym przelewie”. |
| 9 | **Pracownik może zmieniać limit** (`PATCH /accounts/:id/limit`) z walidacją zakresu po stronie serwera i wpisem w audycie. Dziś CASL daje 403. | Panel pracownika: zmiana limitu. |
| 10 | **Klienci**: encja z imieniem, nazwiskiem, e-mailem, numerem klienta. `GET /customers?query=` (pracownik) i `GET /customers/:id` z kontami i historią. **Każdy odczyt zapisuje wpis w `AuditLog`.** | Wyszukiwanie klienta, szczegóły klienta (SR-14). |
| 11 | **Żądania płatności** (QR, link): `GET /payment-requests/:id` (partner, kwota, tytuł, `expiresAt`, status), `POST .../approve` (idempotencja, step-up), `POST .../reject`. Wygasanie po czasie. | Ekran „Zapłać”. Kwota ma pochodzić z serwera, nie z linku. |
| 12 | **Rodzaj operacji w historii**: czytelna kategoria (przelew, płatność QR/link, wpływ) i nazwa kontrahenta także dla wpływów. Dziś `type` to `INTERNAL_TRANSFER`/`EXTERNAL_TRANSFER`/`DEPOSIT`, a `receiverName` to zawsze odbiorca. | Lista operacji, filtry „wpływy / wydatki / płatności”. |
| 13 | **Filtry i stronicowanie** historii: `from`, `to`, `direction`, `type`, `limit`, `cursor`. Dziś serwer zwraca wszystko. | Ekran historii. |
| 14 | **Przelewy zewnętrzne** (do IBAN spoza banku) albo jawna decyzja, że są poza zakresem. Dziś odbiorca musi mieć konto w tym banku (inaczej 404). | Formularz przelewu przyjmuje dowolny polski IBAN. |
| 15 | **Numer operacji i potwierdzenie** w odpowiedzi potwierdzenia przelewu / płatności (`reference`, `executedAt`). | Ekran „Przelew wykonany”. |
| 16 | **Numer tabeli kursów** (np. `196/A/NBP/2026`) w `GET /public/rates`. | Ekran kursów. |

## P2 – jakość i porządek

| # | Zadanie |
| --- | --- |
| 17 | **Nazwy i kształty danych:** nazwa konta po polsku albo pole `displayName` (dziś `Personal Account PLN`); nazwy walut po polsku albo front mapuje po `code` (decyzja po stronie frontu). |
| 18 | **Kwoty:** zdecydować, czy API zostaje przy złotych jako liczbach dziesiętnych (front przelicza ×100 w mapperze, ryzyko zaokrągleń), czy przechodzi na grosze (`amountMinor`, liczby całkowite). Rekomendacja: grosze. |
| 19 | **Zapisani odbiorcy** (`GET/POST/DELETE /recipients`) – ekran odbiorców jest w nawigacji. |
| 20 | **Ustawienia i klucze dostępu** (`/me/settings`, rejestracja i lista kluczy WebAuthn/passkey) – ekran Profil. |
| 21 | **Admin:** użytkownicy, partnerzy; dziennik audytu z filtrem i stronicowaniem (dziś ostatnie 100, `details` jako tekst JSON). |
| 22 | **Bankomaty** `GET /atms` – ekran jest „wkrótce”, można pominąć. |
| 23 | **CORS** ograniczony do znanych originów (dziś otwarty dla wszystkich), limity zapytań (429), nagłówki bezpieczeństwa. |
| 24 | **Zdrowie i dane demo:** seed zgodny z danymi frontu (konto „Osobisty”, IBAN, 4 operacje) ułatwi porównanie mock ↔ API. |

## Proponowana kolejność

1. P0 #7 (openapi.json) i #6 (format błędów): odblokowują generowany klient.
2. P0 #1–2 (logowanie, profil), potem #3–5 (przelew z step-up i idempotencją).
3. P1 #8, #12, #13, #15 (konta i historia), potem #9–10 (pracownik), potem #11 (płatności).
4. P2 według potrzeb.

Bez P0 front może działać tylko w trybie hybrydowym (konta, historia, kursy, blokada konta na API; reszta na mocku).
