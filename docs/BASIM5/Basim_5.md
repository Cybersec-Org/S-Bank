# Raport bezpieczeństwa — S-Bank (sekcja <WPISZ_NR_SEKCJI>)

## 1. Kryptografia w aplikacji

### 1.1. Miejsca użycia kryptografii

| Miejsce w aplikacji | Zadanie | Co jest teraz | Klucz: skąd i gdzie | Problem | Decyzja i źródło |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Podpis potwierdzenia przelewu | Autentyczność i niezaprzeczalność | `signature.service.ts` oraz `accounts.service.ts` — podpis ECDSA P-256 (SHA-256) w Node `crypto` | Para kluczy ECDSA generowana w pamięci/środowisku procesu API | Klucz prywatny w pamięci procesu API (brak izolacji sprzętowej/HSM) | Przeniesienie operacji podpisu do modułu SoftHSM2 przez PKCS#11; klucz publiczny w `GET /public/keys` (OWASP MASVS-CRYPTO, NIST SP 800-186) |
| Weryfikacja sesji użytkownika (OIDC + PKCE) | Autentyczność i integralność tokenu | `mock-auth.guard.ts` — weryfikacja JWT przez `jose` (JWKS) oraz tryb deweloperski z nagłówkami `x-user-*` | Klucz publiczny pobierany z endpointu JWKS serwera Keycloak | Aktywny fallback na nagłówki `x-user-id`/`x-user-role` pozwala pominąć JWT w trybie dev | Twarda blokada trybu mock przy `NODE_ENV=production` i pełna weryfikacja OIDC + PKCE + `acr=2` z Keycloaka (RFC 7636, OWASP ASVS V2/V3) |
| Uwierzytelnianie partnerów B2B (mTLS) | Uwierzytelnianie wzajemne i powiązanie certyfikatu | `partner-auth.guard.ts` — sprawdzanie `x-partner-id` i opcjonalnie `x-client-cert-sha256` | Oczekiwany odcisk SHA-256 z `process.env`, z domyślnym fallbackiem w kodzie (`partner-auth.guard.ts`) | Domyślne wartości fallback w kodzie oraz opcjonalność nagłówka certyfikatu w trybie dev | Wymuszenie mTLS w Caddy, usunięcie wartości domyślnych z kodu i obowiązkowe sprawdzanie odcisku wg RFC 8705 (RFC 8705, OWASP API Security) |
| Przechowywanie tokenów na urządzeniu (Mobile) | Poufność i integralność tokenów | Aplikacja mobilna (Expo) — obecnie tryb mock bez trwałego zapisu produkcyjnych tokenów OIDC | Docelowo klucz zarządzany przez systemowy Keystore / Keychain | Ryzyko zapisu tokenów w nieszyfrowanym `AsyncStorage` przy integracji z Keycloak | Przechowywanie tokenów wyłącznie w `expo-secure-store` z ochroną biometrią, bez użycia `AsyncStorage` (OWASP MASVS-STORAGE, dokumentacja Expo SecureStore) |

---

### 1.2. Kategorie błędów

| Kategoria | Wynik | Jak szukaliśmy |
| :--- | :--- | :--- |
| Klucz w kodzie | znaleziono — wiersz 3 z 1.1 (`partner-auth.guard.ts` — domyślne napisy fallback dla odcisków certyfikatów; właściwych kluczy prywatnych i haseł brak) | Przeszukanie repozytorium (`grep`/`rg`) po frazach `PRIVATE KEY`, `secret`, `password`, `sha256`, `token` oraz ręczny przegląd modułu autoryzacji i `.env.example`. |
| Przestarzały algorytm lub tryb | sprawdzone, brak | Przeszukanie kodu backendu i aplikacji mobilnej po frazach `MD5`, `SHA1`, `DES`, `RC4`, `ECB`, `CBC`, `createCipher`; weryfikacja użycia ECDSA P-256 (SHA-256) w `signature.service.ts`. |
| Przewidywalna losowość | sprawdzone, brak (wcześniejsze `Math.random()` zastąpiono kryptograficznym `node:crypto.randomInt()` w `accounts.service.ts`) | Przeszukanie kodu pod kątem `Math.random` oraz przegląd generatorów numerów operacji (`operationNumber`) i numerów IBAN. |
| Powtarzane wartości jednorazowe | sprawdzone, brak | Przegląd wywołań `node:crypto` w `signature.service.ts` (losowy parametr podpisu generowany przez OpenSSL/Node) oraz brak własnych implementacji szyfrowania z ręcznym IV/nonce. |
| Hasło jako zwykły skrót | sprawdzone, brak (nie dotyczy bazy API — aplikacja nie przechowuje haseł; uwierzytelnianie i Passkeys delegowane do Keycloak) | Przegląd schematu bazy (`schema.prisma` — brak pól haseł w modelu `Customer`) oraz analiza przepływu OIDC. |
| Szyfrowanie bez integralności | sprawdzone, brak | Przeszukanie kodu po `createCipheriv` i `AES`; brak własnego szyfrowania bez AEAD — tranzyt chroni TLS w Caddy, a tokeny mobilne trafią do Keystore/Keychain (`expo-secure-store`). |

---

### 1.3. Uzasadnienie decyzji

#### Decyzja 1: Podpis potwierdzenia przelewu (ECDSA P-256 + PKCS#11 / SoftHSM2)
1. Zapewnienie autentyczności i niezaprzeczalności potwierdzenia przelewu wystawionego przez bank.
2. Algorytm ECDSA na krzywej P-256 z SHA-256 jest obecnie zalecany do podpisów cyfrowych (OWASP MASVS-CRYPTO, NIST SP 800-186).
3. Klucz prywatny leży wyłącznie w module HSM (SoftHSM2 / PKCS#11) po stronie serwera i używa go tylko `SignatureService`, a klucz publiczny jest udostępniany jawnie w `GET /public/keys`.
4. Wartości jednorazowe (parametr `k` w ECDSA) są generowane niezależnie przez bibliotekę kryptograficzną przy każdym podpisie, a `operationNumber` losuje CSPRNG (`randomInt`).
5. Tak — dowolna zmiana kwoty, daty lub IBAN-u w potwierdzeniu powoduje odrzucenie podpisu w `POST /public/verify-confirmation`.
6. W razie wycieku unieważniamy stary klucz, generujemy nową parę w HSM i publikujemy nowy klucz publiczny w `/public/keys` z okresem przejściowym na weryfikację starszych potwierdzeń.

#### Decyzja 2: Weryfikacja sesji użytkownika (OIDC + PKCE + Passkeys step-up)
1. Zapewnienie autentyczności użytkownika i integralności tokenów dostępowych (w tym poziomu uwierzytelnienia `acr=2` dla przelewów od $1000$ PLN).
2. OpenID Connect z Authorization Code + PKCE oraz weryfikacją JWT przez JWKS to aktualny standard dla aplikacji mobilnych i API (RFC 7636, OWASP ASVS).
3. Klucz prywatny podpisujący tokeny leży wyłącznie w Keycloak, a backend pobiera wyłącznie jawny klucz publiczny z endpointu JWKS.
4. Wartości jednorazowe (`state`, `nonce`, `code_verifier`) są losowane osobno dla każdego logowania przez klienta OIDC i odrzucane po jednorazowym użyciu.
5. Tak — każda modyfikacja payloadu tokenu JWT (np. zmiana roli na `ADMIN` lub `acr` na `2`) unieważnia podpis weryfikowany przez `jose`.
6. W przypadku kompromitacji klucza podpisującego wykonujemy rotację kluczy w panelu Keycloak, co natychmiast unieważnia stare tokeny po odświeżeniu JWKS.

#### Decyzja 3: Uwierzytelnianie partnerów B2B (mTLS + RFC 8705)
1. Zapewnienie wzajemnego uwierzytelniania serwer–partner oraz powiązania tożsamości partnera z konkretnym certyfikatem klienta.
2. Mutual TLS w połączeniu z weryfikacją odcisku certyfikatu jest zalecanym standardem dla komunikacji API B2B (RFC 8705, OWASP API Security).
3. Klucz prywatny certyfikatu posiada wyłącznie partner, reverse proxy Caddy weryfikuje go względem zaufanego CA, a odcisk SHA-256 w `PartnerAuthGuard` pochodzi ze zmiennych środowiskowych.
4. Wartości jednorazowe sesji TLS (handshake randoms) są losowane na nowo przy każdym połączeniu przez stos TLS w Caddy.
5. Tak — warstwa TLS gwarantuje integralność całej transmisji, a każda zmiana certyfikatu klienta zmienia jego skrót SHA-256 i kończy się błędem `401 Unauthorized`.
6. W razie wycieku certyfikatu partnera odwołujemy go (CRL / usunięcie odcisku z konfiguracji środowiska) i wystawiamy nowy certyfikat z CA.

#### Decyzja 4: Przechowywanie tokenów na urządzeniu mobilnym (`expo-secure-store`)
1. Zapewnienie poufności i integralności tokenów sesyjnych przechowywanych lokalnie w aplikacji mobilnej.
2. Korzystanie z natywnych magazynów kluczy (Android Keystore / iOS Keychain) przez `expo-secure-store` jest zalecane zamiast `AsyncStorage` (OWASP MASVS-STORAGE).
3. Klucz szyfrujący generuje i przechowuje system operacyjny w Android Keystore / iOS Keychain; dostęp do niego ma wyłącznie nasza aplikacja (z opcjonalną biometrią).
4. Wartości jednorazowe (IV) dla szyfrowania wpisów są generowane automatycznie przez natywną implementację Keystore/Keychain przy każdym zapisie.
5. Tak — systemowy magazyn korzysta z uwierzytelnionego szyfrowania (AEAD), więc modyfikacja zaszyfrowanych danych skutkuje błędem odczytu.
6. Klucza sprzętowego nie da się wyeksportować z urządzenia; w razie utraty telefonu użytkownik unieważnia sesję w Keycloak, a po reinstalacji loguje się ponownie.

---

## 2. Stan aplikacji i plan

### Werdykt MVP

**Werdykt MVP: warunkowo.**
Największe ryzyko: backend MVP z bazą PostgreSQL, autoryzacją CASL (BOLA 404), podpisywaniem przelewów i strefą publiczną jest gotowy, ale do pełnego działania end-to-end brakuje jeszcze spięcia aplikacji mobilnej z docelowym Keycloak (OIDC + PKCE + `expo-secure-store`) oraz wyłączenia trybu deweloperskiego mock w guardach API.

---

### Stan aplikacji

| Obszar | Status | Największe ryzyko |
| :--- | :--- | :--- |
| Funkcje (MVP) | Gotowe (Backend) / W trakcie (Mobile) | Nowe endpointy backendu (`/recipients`, `/payment-requests`, `/public/atms`, `/admin/config`) nie są jeszcze w pełni podpięte pod wszystkie ekrany w Expo. |
| Build z repozytorium | Działa | Ryzyko rozbieżności zmiennych środowiskowych (`.env`, baza PostgreSQL) między maszynami członków zespołu przy stawianiu pełnego stacku. |
| Model zagrożeń | Gotowy | Wymaga dopisania drobnej aktualizacji po dodaniu Nominatim OSM dla `/public/atms` (ryzyko niskie — GPS nie opuszcza telefonu, wysyłana jest tylko nazwa miasta). |
| Uprawnienia | Gotowe (Backend) / W trakcie (Mobile) | Na API działa CASL + BOLA 404 + `AuditLog`, ale uprawnienia mobilne (`expo-camera`, `expo-location`, powiadomienia) wymagają końcowej weryfikacji na urządzeniu. |
| Przechowywanie danych | Częściowo | Baza PostgreSQL jest poprawnie zamodelowana (brak haseł, bezpieczne dane w `PaymentRequest`), ale aplikacja mobilna musi docelowo zapisać tokeny w `expo-secure-store`. |
| Kryptografia | Częściowo | Podpis ECDSA P-256 i weryfikacja JWKS działają, ale klucz prywatny podpisu czeka na podpięcie SoftHSM2 (PKCS#11), a `PartnerAuthGuard` na usunięcie fallbacków dev. |

---

### Plan do zajęć 6

| Zadanie | Kto | Termin | Sposób sprawdzenia |
| :--- | :--- | :--- | :--- |
| Usunięcie fallbacków w `PartnerAuthGuard` oraz blokada trybu mock w `MockAuthGuard` dla `NODE_ENV=production` | Mateusz | 24.11.2026 | Test `curl` bez tokenu JWT i z błędnym `x-client-cert-sha256` zwraca `401 Unauthorized`; przegląd commita w repozytorium. |
| Konfiguracja finalnego realmu Keycloak (OIDC + PKCE, Passkeys `acr=2`) oraz uruchomienie kontenera SoftHSM2 (PKCS#11) | Kacper | 26.11.2026 | Zalogowanie użytkownika przez Keycloak, uzyskanie tokenu z `acr=2` oraz obecność klucza podpisującego w slocie SoftHSM2. |
| Podpięcie `SignatureService` pod działający kontener SoftHSM2 (PKCS#11) | Kacper | 27.11.2026 | Wykonanie przelewu (`POST /transfers/:id/confirm`) i pozytywna weryfikacja podpisu w `POST /public/verify-confirmation` (`valid: true`). |
| Integracja logowania OIDC (`expo-auth-session`), zapisu tokenów w `expo-secure-store` oraz ekranów QR i mapy bankomatów | Michał | 28.11.2026 | Nagranie / demo na żywo: logowanie przez Keycloak, brak tokenów w `AsyncStorage`, skan QR płatności i sortowanie bankomatów po GPS. |
| Wspólne testy integracyjne całego przepływu E2E (Mobile $\rightarrow$ Caddy mTLS $\rightarrow$ NestJS $\rightarrow$ PostgreSQL) | Kacper | 29.11.2026 | Przejście scenariusza demo MVP (przelew poniżej $1000$ zł, przelew od $1000$ zł z Passkey, BOLA `404`, podpis potwierdzenia) bez błędów. |