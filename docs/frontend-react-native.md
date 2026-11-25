# S-Bank – front w React Native: zadanie dla Claude Code

Ten plik to instrukcja w dwóch etapach:

1. **Etap 1** – ekrany aplikacji w React Native (Expo) według makiet, na danych testowych (mock).
2. **Etap 2** – podłączenie ekranów do **API, które już istnieje w tym repozytorium**.

Jak używać: umieść plik w repozytorium (np. `docs/frontend-react-native.md`) i w Claude Code napisz:

- „Wykonaj etap 1 z `docs/frontend-react-native.md`.”
- po przejrzeniu wyniku: „Wykonaj etap 2 z `docs/frontend-react-native.md`.”

Etapy wykonuj osobno. Nie zaczynaj etapu 2, dopóki nie zostaniesz o to poproszony.

---

## 0. Zasady obowiązujące w obu etapach

- **Najpierw przeczytaj zasady repozytorium:** `CLAUDE.md`, `AGENTS.md`, `.claude/rules/*.md` (zwłaszcza reguły dla `app/`), `.claude/skills/` (np. `new-screen`). Jeśli coś w tym pliku jest z nimi sprzeczne, pierwszeństwo mają zasady repozytorium – zgłoś konflikt w podsumowaniu.
- **Nie wykonuj operacji Git** (commit, push, gałęzie, PR). Na końcu każdego etapu podaj podsumowanie zmian i propozycje commitów.
- **Nie czytaj i nie zmieniaj** `.env`, kluczy, certyfikatów. Adres API i inne ustawienia trafiają do `.env.example` jako przykład; prawdziwe wartości uzupełnia właściciel.
- **Zależności:** nowe pakiety instaluj przez `npx expo install` (zgodne wersje z SDK). Przed dodaniem pakietu spoza listy w sekcji 1.2 zapytaj.
- **Język:** TypeScript w trybie `strict`, interfejs po polsku (teksty jak w makietach).
- **Bezpieczeństwo po stronie aplikacji** (z wymagań projektu SR-09, SR-12):
  - access token i dane finansowe (saldo, historia, rachunki) **tylko w pamięci** – nigdy w AsyncStorage, plikach ani logach;
  - refresh token wyłącznie w `expo-secure-store` (na telefonie), w wersji web tylko w pamięci;
  - w AsyncStorage wolno trzymać tylko preferencje (np. motyw, flaga „biometria włączona”);
  - żadnych `console.log` z tokenami, kwotami, IBAN-ami ani odpowiedziami API;
  - limit dzienny, próg 1 000 zł i saldo **sprawdza serwer** – aplikacja je tylko pokazuje; nie traktuj walidacji w aplikacji jako zabezpieczenia;
  - deep link i kod QR niosą **tylko identyfikator** żądania płatności – kwotę i odbiorcę zawsze pobieraj z API.

---

## ETAP 1 – ekrany według makiet (dane testowe)

### 1.1 Punkt wyjścia

1. Sprawdź, czy w repozytorium jest już aplikacja w `app/` (Expo). Jeśli jest – rozbuduj ją, zachowując istniejącą strukturę i konwencje. Jeśli nie ma – utwórz ją w `app/` szablonem Expo z TypeScript i Expo Router.
2. Jeśli w repozytorium są pliki makiet (`docs/makiety/*.dc.html` lub podobne) – traktuj je jako wzór pikselowy. Jeśli ich nie ma, wystarczy opis z sekcji 1.6.
3. Aplikacja ma działać na **Androidzie, iOS i w przeglądarce** (react-native-web). Panel pracownika jest przeznaczony głównie dla wersji web.

### 1.2 Biblioteki

| Cel | Pakiet |
| --- | --- |
| Nawigacja | `expo-router` |
| Dane z serwera, cache w pamięci | `@tanstack/react-query` |
| Krój pisma | `@expo-google-fonts/figtree` + `expo-font` |
| Ikony | `react-native-svg` (ikony liniowe jak w makietach, kreska 1,8–2, zaokrąglone końce) |
| Formularze i walidacja | `react-hook-form` + `zod` |
| Bezpieczny magazyn (na etap 2) | `expo-secure-store` |
| Bezpieczne obszary ekranu | `react-native-safe-area-context` |

Kamera (`expo-camera`), lokalizacja, biometria i WebView **nie wchodzą** w etap 1 – przycisk „Skanuj QR” prowadzi od razu do ekranu płatności z danymi testowymi, „Bankomaty” może prowadzić do pustego ekranu „Wkrótce”.

### 1.3 Styl wizualny (design tokens)

Utwórz `app/src/theme/` z tokenami i używaj ich wszędzie (bez kolorów wpisanych na sztywno w ekranach).

| Token | Wartość | Zastosowanie |
| --- | --- | --- |
| `bg` | `#F3F6F4` | tło ekranów |
| `surface` | `#FFFFFF` | karty, pola, dolna nawigacja |
| `text` | `#10201C` | tekst główny |
| `textMuted` | `#4A5A55` | etykiety, opisy, nieaktywne zakładki |
| `textDisabled` | `#5B6A65` | zablokowane pozycje menu |
| `primary` | `#0E5A47` | przyciski główne, karta salda, kwoty przychodzące, aktywna zakładka |
| `primaryPressed` | `#0A4335` | stan wciśnięcia / hover linków |
| `primarySoft` | `#E1EEE9` | panele informacyjne, chipy |
| `onPrimarySoft` | `#173B31` | tekst na `primarySoft` |
| `onPrimaryMuted` | `#D6EBE4` | tekst drugorzędny na karcie salda |
| `warningBg` | `#FFF1DC` | panel step-up, baner „tylko do odczytu” |
| `warningText` | `#6B3A00` | tekst na `warningBg` |
| `danger` | `#8A2A1B` | „Zablokuj rachunek” |
| `border` | `#D5DEDA` | ramki kart |
| `borderStrong` | `#B9C7C1` | ramki pól i przycisków drugorzędnych |
| `divider` | `#E6ECE9` | separatory w listach |
| `neutralChip` | `#E9EFEC` | etykieta „Panel pracownika” |

- **Krój:** Figtree 400/500/600/700/800. Kwoty: cyfry tabelaryczne (`fontVariant: ['tabular-nums']`).
- **Wymiary:** projekt dla ekranu 390 × 844; boczny margines 20 px (logowanie 24 px); zaokrąglenia kart 16–22 px, pól 12–14 px; przyciski główne 56 px, drugorzędne 48–52 px, **każdy element dotykowy min. 44 × 44**.
- **Typografia (px):** tytuł ekranu 20/700; nagłówek sekcji 17/700; nazwisko na pulpicie 22/700; saldo 38/800; kwota w formularzu 28/800; kwota na potwierdzeniu 36/800, na płatności 40/800; tekst listy 15/600; etykiety 13/600 w `textMuted`.
- **Dostępność:** `accessibilityRole`, `accessibilityLabel` dla przycisków-ikon (np. „Wróć do pulpitu”, „Zablokuj aplikację”), pasek limitu z opisem („Wykorzystanie limitu dziennego: 25 procent”), aktywna zakładka z `accessibilityState={{ selected: true }}`.

### 1.4 Struktura katalogów

Dopasuj do istniejącej struktury, jeśli jest. W przeciwnym razie:

```
app/
  app/                      # trasy Expo Router
    _layout.tsx             # fonty, QueryClientProvider, SafeArea, AuthProvider (atrapa)
    index.tsx               # przekierowanie: zalogowany → (tabs), inaczej → login
    login.tsx
    (tabs)/
      _layout.tsx           # dolna nawigacja: Pulpit, Przelewy, Kursy, Profil
      index.tsx             # Pulpit
      transfers.tsx         # Nowy przelew
      rates.tsx             # Kursy walut
      profile.tsx           # Profil (wylogowanie)
    transfer/confirm.tsx    # Potwierdzenie przelewu
    pay/[id].tsx            # Płatność z QR / linku (id z trasy)
    history.tsx             # Cała historia
    employee/index.tsx      # Panel pracownika (web)
  src/
    theme/                  # tokeny
    components/             # Button, Card, TextField, AmountField, InfoBanner, ListRow, ProgressBar, ScreenHeader, Icon
    domain/                 # typy domenowe i funkcje czyste (formatowanie, IBAN)
    data/
      ports.ts              # interfejsy źródeł danych (patrz 1.5)
      mock/                 # implementacja na danych testowych
      index.ts              # wybór implementacji (w etapie 1 zawsze mock)
    hooks/                  # hooki TanStack Query: useAccounts, useTransactions, useRates…
```

### 1.5 Warstwa danych – przygotowana pod etap 2

Ekrany **nie importują danych testowych bezpośrednio**. Korzystają z hooków, a hooki z interfejsów w `src/data/ports.ts`. W etapie 2 podmienia się tylko implementację, bez zmian w ekranach.

Interfejsy opisz według potrzeb ekranów (w etapie 2 dopasujesz je do prawdziwego API):

- `AccountsSource` – lista rachunków klienta (id, nazwa, maskowany numer, saldo, waluta, limit dzienny, wykorzystanie limitu dziś).
- `TransactionsSource` – historia rachunku z filtrem po dacie i rodzaju; ostatnie N operacji.
- `TransfersSource` – utworzenie projektu przelewu → wynik z informacją, czy wymagane jest dodatkowe potwierdzenie; potwierdzenie przelewu po id.
- `PaymentRequestsSource` – pobranie żądania płatności po id; zatwierdzenie; odrzucenie.
- `RatesSource` – kursy (kod, nazwa, kurs średni, numer i data tabeli).
- `EmployeeSource` – wyszukanie klienta, rachunki i historia klienta, zmiana limitu, blokada / odblokowanie rachunku.
- `SessionSource` – atrapa sesji: zalogowany użytkownik (imię, nazwisko, rola), zaloguj, wyloguj.

Zasady modelu domenowego:

- **kwoty jako liczby całkowite w groszach** (`amountMinor: number`), formatowanie dopiero w widoku;
- formatowanie `pl-PL` z twardą spacją: `4 280,15 zł`, kwoty ujemne ze znakiem minus `−18,40 zł`, dodatnie z `+` i kolorem `primary`;
- daty: na liście `8 paź`, w tabelach panelu `8.10.2026`;
- numer rachunku pokazywany jako `•••• 4821`, IBAN w grupach po 4 znaki;
- walidacja IBAN (PL, 28 znaków, suma kontrolna mod 97) jako funkcja czysta z testem jednostkowym.

Mock: odpowiedzi z opóźnieniem ok. 300 ms, żeby było widać stany ładowania. Dane testowe – dokładnie z makiet (sekcja 1.6).

### 1.6 Ekrany

#### 1. Logowanie (`login.tsx`)

- Na górze (odstęp ok. 96 px): logo – kwadrat 84 × 84, zaokrąglenie 24, tło `primary`, biała ikona; napis **S-Bank** 34/800; podtytuł w dwóch liniach „Prosta bankowość. / Poważne zabezpieczenia.” 16 px, `textMuted`, wyśrodkowany.
- Na dole, w kolumnie co 12 px:
  - przycisk główny z ikoną klucza: **„Zaloguj się kluczem dostępu”**;
  - przycisk drugorzędny (białe tło, ramka `borderStrong`): **„Zaloguj się hasłem”**;
  - panel informacyjny `primarySoft` z ikoną tarczy: „Logowanie otworzy stronę banku w przeglądarce systemowej. Aplikacja nigdy nie widzi Twojego hasła.”
- Separator z tekstem „masz już sesję na tym urządzeniu?” i przycisk obrysowany w kolorze `primary`: **„Odblokuj biometrią”**.
- Linki: „Regulamin”, „Kursy walut” (Kursy działają bez logowania).
- Etap 1: oba przyciski logowania ustawiają atrapę sesji klienta i przechodzą do pulpitu. Dodaj ukryty w trybie deweloperskim przełącznik „Zaloguj jako pracownik” → panel pracownika. Biometria – nieaktywna (etap późniejszy).

#### 2. Pulpit (`(tabs)/index.tsx`)

- Nagłówek: „Dzień dobry” (14/500, `textMuted`) i **Anna Nowak** (22/700); po prawej przycisk 44 × 44 z kłódką, `accessibilityLabel="Zablokuj aplikację"`.
- Karta rachunku (tło `primary`, biały tekst, zaokrąglenie 22): „Rachunek osobisty” i `•••• 4821`; saldo **4 280,15 zł**; pod spodem „≈ 977,45 EUR po kursie NBP” (liczone z kursu EUR z `RatesSource`) i „Limit dziś: 5 000 zł”.
- Skróty w siatce 4 kolumn (białe kafelki z ikoną w kolorze `primary`): **Przelew**, **Skanuj QR**, **Kursy**, **Bankomaty**.
- „Ostatnie operacje” + link „Cała historia” → `history.tsx`. Lista w karcie, każdy wiersz: nazwa (15/600), pod spodem rodzaj · data (13 px, `textMuted`), po prawej kwota:
  - Wynagrodzenie · Przelew przychodzący · 8 paź · **+5 400,00 zł**
  - Piekarnia Pod Lipą · Płatność z kodu QR · 7 paź · **−18,40 zł**
  - Marek Wiśniewski · Przelew przychodzący · 5 paź · **+120,00 zł**
  - Sklep Rowerowy Szprycha · Płatność z linku · 2 paź · **−249,00 zł**
- Dolna nawigacja: Pulpit, Przelewy, Kursy, Profil (aktywna `primary` 700, pozostałe `textMuted` 600).
- Stany: ładowanie (szkielety kart), błąd z przyciskiem „Spróbuj ponownie”, pusta historia.

#### 2a. Historia operacji (`history.tsx`) – brak osobnej makiety

Ta sama lista co na pulpicie, ale pełna, z filtrem rodzaju (wszystkie / przychodzące / wychodzące / płatności) i zakresu dat. Styl jak lista na pulpicie, nagłówek jak na ekranie przelewu (strzałka wstecz + tytuł).

#### 3. Nowy przelew (`(tabs)/transfers.tsx`)

- Nagłówek: strzałka wstecz (44 × 44, „Wróć do pulpitu”) + **„Nowy przelew”** 20/700.
- Karta „Z rachunku: Osobisty •••• 4821” / „Dostępne: 4 280,15 zł”.
- Formularz (etykiety 13/600 `textMuted`, pola 50 px, ramka `borderStrong`, zaokrąglenie 14):
  - **Odbiorca** – przykład „Spółdzielnia Mieszkaniowa Zacisze”;
  - **Numer rachunku** – klawiatura numeryczna, formatowanie w grupach: „PL61 1090 1014 0000 0712 1981 2874”;
  - **Kwota** – pole 64 px z ramką 2 px `primary`, tekst 28/800, przyrostek „zł”, klawiatura dziesiętna, przecinek jako separator; przykład „1 250,00”;
  - **Tytuł** – przykład „Czynsz – październik”.
- Gdy kwota ≥ 1 000 zł: panel `warningBg` z ikoną klucza: „**Kwota od 1 000 zł.** W następnym kroku potwierdzisz przelew kluczem dostępu.”
- Pasek limitu: „Limit dzienny po tym przelewie” – „1 250 z 5 000 zł”, pasek 8 px (`border` jako tło, wypełnienie `primary`), aktualizowany na żywo z kwotą.
- Przycisk **„Dalej”** na dole → walidacja (zod: wymagane pola, poprawny IBAN, kwota > 0, maks. 2 miejsca po przecinku) → utworzenie projektu przelewu przez `TransfersSource` → przejście do potwierdzenia z id projektu.
- Na przyszłość (FR-06): przy polu „Odbiorca” miejsce na wybór z listy zapisanych odbiorców – w etapie 1 wystarczy nieaktywny przycisk lub pominięcie.

#### 4. Potwierdzenie przelewu (`transfer/confirm.tsx`)

- Nagłówek: strzałka („Wróć do formularza”) + **„Potwierdź przelew”**.
- Karta podsumowania (zaokrąglenie 20): „Kwota” i **1 250,00 zł** (36/800) wyśrodkowane, separator, potem pary etykieta/wartość: Odbiorca, Numer rachunku, Tytuł, Z rachunku.
- Jeśli projekt wymaga dodatkowego potwierdzenia: panel `warningBg` – okrągła biała ikona klucza 56 px, „**Dodatkowe potwierdzenie**”, „Ten przelew wymaga klucza dostępu. Użyj odcisku palca lub rozpoznawania twarzy na tym urządzeniu.”
- Nad przyciskami: ikona dokumentu i „Po wykonaniu dostaniesz potwierdzenie podpisane przez bank.”
- Przyciski: **„Potwierdź kluczem dostępu”** (z ikoną klucza; dla kwot < 1 000 zł tekst „Potwierdź przelew”) i **„Anuluj”** (bez tła).
- **Dane na ekranie pochodzą z projektu przelewu pobranego po id**, nie z parametrów nawigacji – ekran przyjmuje tylko id.
- Po sukcesie: komunikat o wykonaniu i powrót na pulpit z odświeżeniem salda i historii (invalidacja zapytań).

#### 5. Płatność z kodu QR lub linku (`pay/[id].tsx`)

- Trasa przyjmuje **tylko id**; wszystko inne z `PaymentRequestsSource`.
- Nagłówek: strzałka + **„Żądanie płatności”**.
- Chipy: „Otwarto z kodu QR” (lub „Otwarto z linku”, `primarySoft` z ikoną QR) i „Wygasa za 14 min” (biały z ramką; licznik na żywo z czasu ważności).
- Karta: ikona sklepu w kafelku 48 px `primarySoft`; **Sklep Rowerowy Szprycha** 17/700, „Zarejestrowany partner banku”; „Do zapłaty” **249,00 zł** (40/800); wiersze „Tytuł: Zamówienie nr 1042”, „Z rachunku: Osobisty •••• 4821”.
- Panel informacyjny: „Kwotę i odbiorcę pobraliśmy z banku na podstawie identyfikatora żądania. Treść linku nie może ich zmienić.”
- Przyciski: **„Zapłać 249,00 zł”** i **„Odrzuć”**. Płatność ≥ 1 000 zł przechodzi tą samą ścieżką potwierdzenia co przelew.
- Stany: żądanie wygasłe, już opłacone, nie znaleziono – czytelny komunikat i powrót na pulpit.
- Etap 1: skrót „Skanuj QR” otwiera `pay/demo-1042`.

#### 6. Kursy walut (`(tabs)/rates.tsx`) – dostępne bez logowania

- Tytuł **„Kursy walut”** 24/800; podtytuł „Kursy średnie NBP · tabela 196/A/NBP/2026 z 8 października 2026” (numer i data z danych).
- Karta przelicznika: dwa pola obok siebie – „Kwota w złotych” (domyślnie saldo zalogowanego, inaczej puste) i „Waluta” (wybór: EUR – euro, USD – dolar, CHF – frank, GBP – funt, CZK – korona); pod separatorem „To około” i wynik 28/800 w `primary`, np. **977,45 EUR**. Na webie i telefonie użyj wspólnego komponentu wyboru (np. arkusz z listą), nie natywnego `<select>`.
- Lista kursów:

  | Kod | Nazwa | Kurs |
  | --- | --- | --- |
  | EUR | euro | 4,3789 zł |
  | USD | dolar amerykański | 3,9132 zł |
  | CHF | frank szwajcarski | 4,6926 zł |
  | GBP | funt szterling | 5,1635 zł |
  | CZK | korona czeska | 0,1794 zł |

- Dopisek z ikoną globu: „Dostępne bez logowania, także w publicznym API banku: **GET /public/rates**” (w etapie 2 zaktualizuj ścieżkę do faktycznej).
- Dolna nawigacja jak na pulpicie (dla gościa zamiast zakładek klienta – tylko powrót do logowania).

#### 7. Panel pracownika (`employee/index.tsx`) – wersja web

- Pasek górny (biały, ramka dolna): logo 40 px, **S-Bank** 20/800, etykieta „Panel pracownika”; po prawej chip „Zalogowano kluczem dostępu”, imię i nazwisko pracownika (Katarzyna Zielińska), przycisk „Wyloguj”.
- Układ dwukolumnowy (maks. szerokość 1280, odstęp 24), na wąskim ekranie kolumny jedna pod drugą:
  - **menu:** Klienci (aktywne, tło `primary`), Rachunki; zablokowane z kłódką i dopiskiem „tylko administrator”: Dziennik audytowy, Partnerzy API;
  - **treść:** nagłówek **Klienci** 28/800 i pole „Szukaj klienta” (szer. maks. 420);
  - baner `warningBg` z ikoną oka: „**Podgląd tylko do odczytu.** Otwarcie danych tego klienta zostało zapisane w dzienniku audytowym.”;
  - karta klienta: **Anna Nowak**, „anna.nowak@example.com · klient nr 1007”, chip statusu „Rachunek aktywny” (dla zablokowanego – inny kolor i tekst);
  - tabela rachunków: Rachunek | Saldo | Limit dzienny | Działania → „Osobisty •••• 4821 | 4 280,15 zł | 5 000 zł | [Zmień limit] [Zablokuj rachunek]” (drugi przycisk w kolorze `danger`); oba z oknem potwierdzenia, „Zmień limit” z polem kwoty;
  - tabela „Historia operacji”: Data | Opis | Rodzaj | Kwota – te same 4 operacje co na pulpicie, daty `8.10.2026`.
- **Brak jakiegokolwiek przycisku przelewu** w panelu pracownika.
- Tabele przewijane poziomo na wąskim ekranie.

### 1.7 Nawigacja

- Logowanie → Pulpit → Nowy przelew → Potwierdzenie → Pulpit.
- Pulpit → Skanuj QR → Płatność → Pulpit.
- Pulpit / dolna nawigacja → Kursy; Logowanie → Kursy (bez sesji).
- Profil → Wyloguj → Logowanie (czyści cache TanStack Query i atrapę sesji).
- Rola pracownika → od razu panel pracownika; klient nie może wejść na `employee/*` (strażnik trasy – tylko dla wygody, prawdziwą kontrolę robi API).
- Deep link `sbank://pay/{id}` i `https://<domena>/pay/{id}` mapowane na `pay/[id]` w konfiguracji Expo Router (`scheme: "sbank"`); domenę zostaw jako zmienną do uzupełnienia.

### 1.8 Kryteria ukończenia etapu 1

- [ ] `npx expo start` – aplikacja działa w przeglądarce i na Androidzie (emulator lub Expo Go), bez błędów i ostrzeżeń w konsoli.
- [ ] Wszystkie 7 ekranów (+ historia) wygląda jak w makietach na ekranie 390 × 844; panel pracownika poprawny przy 1280 px i przy ~390 px.
- [ ] Ekrany korzystają wyłącznie z hooków i interfejsów z `src/data/ports.ts`; żaden ekran nie importuje `src/data/mock/*`.
- [ ] Kwoty w groszach w całej warstwie danych; formatowanie w jednym module.
- [ ] Testy jednostkowe: formatowanie kwot i dat, walidacja IBAN, przelicznik walut, próg 1 000 zł w widoku.
- [ ] Lint i sprawdzanie typów przechodzą (skrypty z `package.json` repozytorium lub `quality-gate`, jeśli istnieje).
- [ ] Podsumowanie: lista plików, zrzuty lub opis ekranów, odstępstwa od makiet z uzasadnieniem, propozycje commitów.

---

## ETAP 2 – podłączenie do istniejącego API z repozytorium

**Źródłem prawdy jest kod API w tym repozytorium**, a nie opisy w dokumentacji projektu ani założenia z etapu 1. Nie wymyślaj endpointów, pól ani kodów odpowiedzi – wszystko odczytaj z kodu.

### 2.1 Rozpoznanie API (bez zmian w kodzie)

1. Znajdź API w repozytorium (np. `api/`, `backend/`, `server/`). Ustal framework, prefiks ścieżek, port i sposób uruchamiania.
2. Znajdź kontrakt w tej kolejności:
   - plik OpenAPI w repozytorium (`openapi.json` / `.yaml`, `swagger.*`);
   - jeśli go nie ma, a API generuje dokumentację w locie (np. NestJS + `@nestjs/swagger`) – uruchom API lokalnie i pobierz JSON dokumentacji, albo wygeneruj go skryptem z repozytorium;
   - w ostateczności odczytaj kontrolery, DTO, guardy i schematy walidacji bezpośrednio z kodu.
3. Dla każdego endpointu zanotuj: metoda, ścieżka, wymagane uwierzytelnienie i rola, parametry, ciało żądania, kształt odpowiedzi, kody błędów, nagłówki specjalne (np. klucz idempotencji), format kwot (grosze czy liczby dziesiętne) i dat.
4. Ustal, **jak API uwierzytelnia**: Bearer JWT z Keycloak (OIDC), inny dostawca, sesja/cookie, klucz API. Sprawdź, jakie claimy i role czyta (np. `realm_access.roles`, `acr`) i czy wymaga podwyższonego poziomu dla przelewów.
5. Sprawdź konfigurację CORS i adres, pod którym API jest dostępne z aplikacji (lokalnie i na serwerze, np. przez Caddy).

### 2.2 Mapowanie ekranów na endpointy – punkt kontrolny

Zapisz wynik w `docs/frontend-api-mapping.md`:

| Ekran / akcja | Interfejs z `ports.ts` | Endpoint w API | Różnice względem modelu aplikacji | Status |
| --- | --- | --- | --- | --- |
| Pulpit – rachunki | `AccountsSource.list` | … | … | gotowe / brak / niezgodne |
| … | … | … | … | … |

Uwzględnij co najmniej: sesja i profil, rachunki, saldo i limit, ostatnie operacje, historia z filtrem, projekt przelewu, potwierdzenie przelewu, potwierdzenie podpisane przez bank, żądanie płatności (pobranie, zatwierdzenie, odrzucenie), kursy walut, wyszukiwanie klienta, rachunki i historia klienta, zmiana limitu, blokada rachunku.

**Pokaż tabelę i zatrzymaj się**, jeśli którykolwiek ekran nie ma odpowiednika w API albo kontrakt istotnie różni się od potrzeb ekranu. Zaproponuj rozwiązanie (dopasowanie ekranu, tymczasowy mock dla tej jednej funkcji albo zmiana w API przez skill `new-endpoint`) i poczekaj na decyzję. **Nie zmieniaj kodu API bez wyraźnej zgody.** Jeśli wszystko się zgadza – przejdź dalej.

### 2.3 Klient HTTP i typy

- Typy generuj z kontraktu OpenAPI (np. `openapi-typescript` → `src/api/schema.d.ts`) i dodaj skrypt `pnpm`/`npm` do ich odświeżania. Jeśli kontraktu nie ma – napisz typy ręcznie na podstawie DTO i zaznacz to w podsumowaniu.
- Jeden klient w `src/api/client.ts` (np. `openapi-fetch` albo cienka nakładka na `fetch`):
  - adres bazowy z `process.env.EXPO_PUBLIC_API_URL` (dopisz do `.env.example`, bez prawdziwych wartości); w zmiennych `EXPO_PUBLIC_*` nie umieszczaj żadnych sekretów;
  - nagłówek `Authorization: Bearer <access token>` pobierany z pamięci;
  - limit czasu żądań (np. 15 s) i anulowanie przez `AbortController`;
  - przy 401 – jedna próba odświeżenia tokenu, potem wylogowanie;
  - **zero logowania** treści żądań i odpowiedzi.
- Walidacja odpowiedzi `zod` dla krytycznych danych (rachunki, projekt przelewu, żądanie płatności).
- Konwersja z modelu API na model domenowy w jednym miejscu (`src/data/api/mappers.ts`); jeśli API zwraca kwoty inaczej niż w groszach – przelicz tu, nie w ekranach.

### 2.4 Uwierzytelnianie

Zrób to w sposób, którego **faktycznie wymaga API** z punktu 2.1. Jeśli jest to OIDC (Keycloak):

- `expo-auth-session` + `expo-web-browser`: Authorization Code + PKCE w przeglądarce systemowej, nigdy w WebView;
- adres wystawcy, `client_id` i `redirect_uri` z konfiguracji (`EXPO_PUBLIC_OIDC_ISSUER`, `EXPO_PUBLIC_OIDC_CLIENT_ID`) – sprawdź, jakie adresy przekierowań są zarejestrowane w eksporcie realmu w repozytorium, i użyj dokładnie ich; jeśli brakuje adresu dla aplikacji – zgłoś to, nie dopisuj symboli wieloznacznych;
- „Zaloguj się kluczem dostępu” i „Zaloguj się hasłem” – to samo logowanie OIDC, ewentualnie z parametrem wskazującym metodę, jeśli realm to obsługuje;
- access token w pamięci; refresh token w `expo-secure-store` (telefon) lub tylko w pamięci (web); rotacja przy odświeżeniu;
- wylogowanie: usunięcie tokenów, wyczyszczenie cache TanStack Query, zakończenie sesji u dostawcy (end session endpoint);
- rola z tokenu decyduje o trasie startowej (klient → pulpit, pracownik → panel).

**Potwierdzenie przelewu (step-up):** jeśli API przy potwierdzeniu wymaga wyższego poziomu uwierzytelnienia (np. 403 z informacją o `acr`, albo pole w projekcie przelewu), przycisk „Potwierdź kluczem dostępu” uruchamia ponowne logowanie z odpowiednim `acr_values` / `prompt`, a dopiero z nowym tokenem wysyła potwierdzenie. Dokładny mechanizm odczytaj z kodu API i konfiguracji realmu.

Jeśli API nie ma uwierzytelniania albo działa inaczej – dopasuj się do niego i opisz to w podsumowaniu.

### 2.5 Podmiana implementacji

- Utwórz `src/data/api/*` implementujące interfejsy z `ports.ts` na prawdziwym kliencie.
- W `src/data/index.ts` wybieraj implementację zmienną `EXPO_PUBLIC_DATA_SOURCE=api|mock` (domyślnie `api`). Mock zostaje do pracy bez serwera i do testów.
- Jeśli interfejs z etapu 1 nie pasuje do API – zmień interfejs i hooki, a ekrany tylko tam, gdzie to konieczne.
- Przelew: jeśli API przyjmuje klucz idempotencji – generuj go raz na projekt przelewu (`expo-crypto` `randomUUID`) i ponawiaj z tym samym kluczem.
- Płatność z linku: ekran dalej przyjmuje tylko id i pobiera dane z API.

### 2.6 Obsługa błędów

Odczytaj z API format błędów i obsłuż go jednolicie:

| Kod | Zachowanie aplikacji |
| --- | --- |
| 400 / 422 | błędy przy polach formularza (mapowanie nazw pól z odpowiedzi) |
| 401 | odświeżenie tokenu, potem przejście do logowania |
| 403 | brak uprawnień; jeśli to wymóg step-up – uruchom potwierdzenie kluczem dostępu |
| 404 | „Nie znaleziono” (np. wygasłe lub cudze żądanie płatności) |
| 409 | konflikt (np. przelew już potwierdzony, rachunek zablokowany) – odśwież dane |
| 429 | „Zbyt wiele prób, spróbuj za chwilę” (z `Retry-After`, jeśli jest) |
| 5xx / brak sieci | komunikat ogólny i „Spróbuj ponownie”; bez szczegółów technicznych dla użytkownika |

Wynik operacji pieniężnej, której odpowiedź nie dotarła (timeout), sprawdzaj ponownie po id projektu – nie wysyłaj nowego przelewu.

### 2.7 Kryteria ukończenia etapu 2

- [ ] `docs/frontend-api-mapping.md` aktualne – każdy ekran ma endpoint albo opisaną decyzję.
- [ ] Z uruchomionym API: logowanie, pulpit, historia, przelew poniżej i powyżej 1 000 zł, płatność z linku, kursy (bez logowania) i panel pracownika działają na prawdziwych danych.
- [ ] Przy `EXPO_PUBLIC_DATA_SOURCE=mock` aplikacja dalej działa bez serwera.
- [ ] Brak tokenów, kwot i odpowiedzi API w logach, AsyncStorage i plikach (sprawdź wyszukiwaniem w kodzie: `console.`, `AsyncStorage`).
- [ ] Testy: mappery API → domena, obsługa 401/403/429 w kliencie (na atrapach `fetch`), ścieżka przelewu na mocku.
- [ ] Lint, typy i testy przechodzą; `.env.example` uzupełniony o nowe zmienne.
- [ ] Podsumowanie: co podłączono, czego brakuje w API, zmiany w interfejsach z etapu 1, propozycje commitów.

---

## Czego nie robić

- Nie zmieniaj kodu API, migracji ani konfiguracji Keycloak/Caddy bez wyraźnej prośby.
- Nie przenoś logiki bezpieczeństwa (limity, progi, uprawnienia) do aplikacji jako jedynej kontroli.
- Nie zapisuj danych finansowych ani tokenów poza miejscami z sekcji 0.
- Nie loguj się przez WebView i nie przechowuj hasła.
- Nie dodawaj analityki ani zewnętrznych SDK.
- Nie wykonuj commitów, pushy ani PR.
