# BACKLOG – S-Bank

Lista zadań do wprowadzenia w narzędziu do zarządzania projektem (GitHub Projects, Jira, Trello…). Źródło: [scripts/backlog.json](scripts/backlog.json).

**Import:**

- GitHub: `node scripts/create-github-issues.mjs --repo <właściciel>/<repo>` tworzy etykiety, kamienie milowe i zadania przypisane do osób (najpierw wpisz loginy w skrypcie; `--dry-run` pokazuje, co zostanie utworzone, `--project <nr> --owner <właściciel>` dodaje zadania do tablicy Projects).
- Jira / Trello / inne: [scripts/backlog.csv](scripts/backlog.csv).

## Osoby

| Osoba   | Obszar                                      |
| ------- | ------------------------------------------- |
| Osoba 1 | aplikacja React Native (mobile + web)       |
| Osoba 2 | backend API i baza danych                   |
| Osoba 3 | tożsamość: Keycloak, OIDC, passkeys         |
| Osoba 4 | infrastruktura, CI/CD, testy bezpieczeństwa |

Liczba zadań: 35 (Osoba 4: 10, Osoba 1: 8, Osoba 2: 10, Osoba 3: 7).

## Z2 – szkielet

| ID   | Zadanie                                                                                                                                                                                                                | Osoba   | Etykiety         | Powiązane |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------- | --------- |
| B-01 | **Repozytorium: ochrona gałęzi main i szablon PR**<br>Gałąź main chroniona (wymagany PR, co najmniej 1 akceptacja, zielony CI). Szablon PR z listą kontrolną bezpieczeństwa. Plik .gitignore wyklucza .env i klucze.   | Osoba 4 | infra, devsecops | SR-15     |
| B-02 | **Docker Compose: PostgreSQL, Keycloak, Mailpit, Caddy**<br>Jedno polecenie podnosi środowisko lokalne. Sekrety w pliku .env (poza repozytorium) z przykładowym .env.example. Bazy dostępne tylko w sieci wewnętrznej. | Osoba 4 | infra            | –         |
| B-03 | **Szkielet aplikacji Expo (Android + web) z nawigacją**<br>Aplikacja TypeScript na Expo Router uruchamia się na Androidzie i w przeglądarce; puste ekrany: logowanie, pulpit, przelew, kursy.                          | Osoba 1 | frontend         | –         |
| B-04 | **Szkielet API NestJS z /health, Prisma i pierwszą migracją**<br>API odpowiada na /health, ma podpiętą bazę przez Prisma i generuje dokumentację OpenAPI.                                                              | Osoba 2 | backend          | –         |
| B-05 | **Pipeline CI: build, lint i testy**<br>GitHub Actions uruchamia build, lint i testy aplikacji oraz API przy każdym PR.                                                                                                | Osoba 4 | devsecops        | SR-15     |
| B-06 | **Dokumentacja Etapu 1: README, REQUIREMENTS, diagramy, karta projektu**<br>Pliki w repozytorium, uzupełniony skład zespołu i loginy GitHub, diagramy w docs/.                                                         | Osoba 3 | dokumentacja     | –         |

## Z3 – logowanie i dane

| ID   | Zadanie                                                                                                                                                                                                                                                                          | Osoba   | Etykiety                  | Powiązane                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------- | ------------------------- |
| B-07 | **Realm Keycloak jako kod: klienci OIDC, role, polityka haseł, ochrona brute force**<br>Eksport realmu w infra/. Klient publiczny z PKCE i dokładnymi adresami przekierowań, role customer/employee/admin, polityka haseł min. 12 znaków, czasowa blokada po nieudanych próbach. | Osoba 3 | tożsamość, bezpieczeństwo | SR-01, SR-02, T-11        |
| B-08 | **Rejestracja z potwierdzeniem e-maila**<br>Samodzielna rejestracja w Keycloak, e-mail weryfikacyjny wysyłany przez Mailpit, nowe konto dostaje rolę customer.                                                                                                                   | Osoba 3 | tożsamość                 | FR-01                     |
| B-09 | **Zakładanie rachunku demonstracyjnego przy pierwszym logowaniu**<br>Przy pierwszym wywołaniu API przez nowego klienta powstaje rachunek z saldem początkowym; operacja idempotentna.                                                                                            | Osoba 2 | backend                   | FR-01                     |
| B-10 | **Logowanie OIDC z PKCE i wylogowanie w aplikacji**<br>expo-auth-session otwiera Keycloak w przeglądarce systemowej; wylogowanie kończy sesję także w Keycloak.                                                                                                                  | Osoba 1 | frontend, bezpieczeństwo  | FR-02, SR-01              |
| B-11 | **Weryfikacja JWT w API i globalny strażnik „domyślna odmowa”**<br>jose sprawdza podpis (JWKS, tylko dozwolone algorytmy), iss, aud i exp. Endpoint bez deklaracji roli jest niedostępny.                                                                                        | Osoba 2 | backend, bezpieczeństwo   | SR-04, SR-05              |
| B-12 | **Rachunki i historia z kontrolą właściciela (CASL)**<br>Endpointy rachunków i historii z filtrowaniem; cudzy zasób zwraca 404; polityki w jednym module.                                                                                                                        | Osoba 2 | backend, bezpieczeństwo   | FR-03, FR-04, SR-05, T-01 |
| B-13 | **Ekrany pulpitu i historii operacji**<br>Saldo, wykorzystanie limitu, ostatnie operacje, filtr historii; dane tylko w pamięci.                                                                                                                                                  | Osoba 1 | frontend                  | FR-03, FR-04              |
| B-14 | **Przechowywanie tokenów: SecureStore na telefonie, pamięć w przeglądarce**<br>Refresh token w expo-secure-store, access token tylko w pamięci, czyszczenie przy wylogowaniu i po bezczynności, brak tokenów w logach.                                                           | Osoba 1 | frontend, bezpieczeństwo  | SR-09                     |
| B-15 | **Kursy walut: /public/rates z NBP i ekran przelicznika**<br>Backend pobiera tabelę A NBP ze stałego adresu, z limitem czasu, walidacją odpowiedzi (zod) i cache; ekran kursów działa bez logowania.                                                                             | Osoba 2 | backend, bezpieczeństwo   | FR-08, SR-16              |
| B-16 | **Testy autoryzacji – pierwsza partia z kolumny „Czego NIE może”**<br>Jest + supertest: klient nie czyta cudzego rachunku, gość nie dostaje danych, rola bez uprawnień dostaje 403/404.                                                                                          | Osoba 2 | testy, bezpieczeństwo     | SR-05, T-01               |
| B-17 | **CI: analiza statyczna, skan zależności i skan sekretów**<br>Semgrep lub CodeQL, Dependabot / npm audit, gitleaks; wynik wysokiej wagi blokuje scalenie PR.                                                                                                                     | Osoba 4 | devsecops                 | SR-10, SR-15, T-07, T-08  |

## Z4 – przelewy i passkeys

| ID   | Zadanie                                                                                                                                                                                                                                           | Osoba   | Etykiety                  | Powiązane                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------- | ------------------------- |
| B-18 | **Przelewy: projekt i potwierdzenie, transakcja z blokadą, idempotencja, limit**<br>POST tworzy projekt przelewu, potwierdzenie odnosi się do jego ID; saldo i limit w jednej transakcji z blokadą wiersza; kwoty w groszach; klucz idempotencji. | Osoba 2 | backend, bezpieczeństwo   | FR-05, SR-06, SR-07, T-05 |
| B-19 | **Ekrany przelewu i potwierdzenia**<br>Formularz z walidacją IBAN, podsumowanie, informacja o step-up od 1 000 zł, wynik operacji.                                                                                                                | Osoba 1 | frontend                  | FR-05                     |
| B-20 | **Passkeys i step-up (LoA) w Keycloak oraz sprawdzanie acr w API**<br>Logowanie kluczem dostępu; przelew od 1 000 zł i logowanie pracownika/admina wymagają wysokiego acr; API samo sprawdza acr i auth_time.                                     | Osoba 3 | tożsamość, bezpieczeństwo | SR-03, T-02               |
| B-21 | **Odblokowanie aplikacji biometrią**<br>expo-local-authentication przy starcie i po powrocie z tła; refresh token z requireAuthentication.                                                                                                        | Osoba 3 | frontend, bezpieczeństwo  | FR-14, SR-09              |
| B-22 | **Odbiorcy: API i ekran listy**<br>Dodawanie, edycja, usuwanie i wybór odbiorcy przy przelewie; kontrola właściciela.                                                                                                                             | Osoba 2 | backend, frontend         | FR-06                     |
| B-23 | **Płatność z kodu QR i linku (App Links / Universal Links)**<br>Skan QR (expo-camera, zgoda w chwili użycia), link https://<domena>/pay/{id}; dane żądania pobierane z API, zatwierdzenie lub odrzucenie.                                         | Osoba 1 | frontend, bezpieczeństwo  | FR-07, SR-12, T-04        |
| B-24 | **Panel pracownika (web)**<br>Wyszukiwanie klienta, podgląd tylko do odczytu, blokada rachunku, zmiana limitu; brak przycisku przelewu.                                                                                                           | Osoba 1 | frontend                  | FR-09                     |
| B-25 | **Limity zapytań w API i Caddy**<br>@nestjs/throttler na /public, logowaniu i przelewach; po przekroczeniu odpowiedź 429.                                                                                                                         | Osoba 4 | infra, bezpieczeństwo     | SR-11, T-10               |

## Z5 – MVP

| ID   | Zadanie                                                                                                                                                                                                        | Osoba   | Etykiety                  | Powiązane          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------- | ------------------ |
| B-26 | **Własne CA, certyfikaty partnerów i mTLS dla /partner**<br>Caddy przyjmuje na /partner tylko certyfikaty naszego CA; Keycloak wydaje tokeny związane z certyfikatem; API porównuje odcisk certyfikatu.        | Osoba 4 | infra, bezpieczeństwo     | SR-08, T-06        |
| B-27 | **API partnerskie: żądania płatności i ich status**<br>Partner tworzy żądanie (kwota, tytuł, ważność) i czyta wyłącznie własne żądania.                                                                        | Osoba 2 | backend                   | FR-10, SR-05       |
| B-28 | **SoftHSM i podpis potwierdzeń przelewów przez PKCS#11**<br>Nieeksportowalny klucz w SoftHSM2, podpis przez graphene-pk11, klucz publiczny pod /public/keys.                                                   | Osoba 4 | infra, bezpieczeństwo     | FR-11, SR-10, T-07 |
| B-29 | **Dziennik audytowy i panel administratora**<br>Tabela tylko do dopisywania (uprawnienia INSERT), zapis logowań, przelewów, podglądów i zmian ról; widok dla administratora.                                   | Osoba 2 | backend, bezpieczeństwo   | FR-12, SR-14, T-09 |
| B-30 | **WebView z regulaminem, bankomaty (lokalizacja) i powiadomienia**<br>WebView z listą dozwolonych adresów i bez JavaScriptu; lista bankomatów sortowana lokalnie; lokalne powiadomienie o wykonanym przelewie. | Osoba 1 | frontend, bezpieczeństwo  | FR-13, SR-12       |
| B-31 | **Nagłówki bezpieczeństwa, CSP, CORS i skan OWASP ZAP w CI**<br>helmet i Caddy ustawiają nagłówki; ZAP baseline uruchamiany na środowisku testowym w CI.                                                       | Osoba 4 | devsecops, bezpieczeństwo | SR-13              |
| B-32 | **Skan obrazów Dockera (Trivy) w CI**<br>Obrazy API i aplikacji skanowane przy każdym PR; podatność krytyczna blokuje scalenie.                                                                                | Osoba 4 | devsecops                 | SR-15, T-07, T-08  |

## Po MVP

| ID   | Zadanie                                                                                                                                                              | Osoba   | Etykiety                     | Powiązane |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------- | --------- |
| B-33 | **Opis działania mechanizmów bezpieczeństwa w docs/**<br>Dla OIDC, passkeys, mTLS, PKCS#11 i kontroli dostępu: jak działa, gdzie jest w kodzie, jak to przetestować. | Osoba 3 | dokumentacja, bezpieczeństwo | –         |
| B-34 | **Komplet testów autoryzacji i przegląd według MASVS**<br>Test dla każdego wiersza kolumny „Czego NIE może”; lista kontrolna MASVS z wynikami.                       | Osoba 3 | testy, bezpieczeństwo        | SR-05     |
| B-35 | **Aktualizacja modelu zagrożeń po testach**<br>Weryfikacja T-01–T-11 i ryzyk z karty na podstawie wyników testów i skanów.                                           | Osoba 4 | bezpieczeństwo, dokumentacja | –         |
