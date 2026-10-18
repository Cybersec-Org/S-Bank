## Co i dlaczego

<!-- 2–4 zdania. Powiązane: FR-xx, SR-xx, T-xx, B-xx -->

Powiązane:

## Jak sprawdzone

- [ ] `pnpm run format:check`, `lint`, `typecheck`, `test`, `build` przechodzą lokalnie
- [ ] testy e2e API (`pnpm run api:test:e2e`) przy zmianach w `api/`
- [ ] ręcznie sprawdzone na: ☐ Android ☐ iOS ☐ web
- [ ] zrzuty ekranu / nagranie przy zmianach w UI

## Lista kontrolna bezpieczeństwa

- [ ] Nowe endpointy mają strefę, role i kontrolę właściciela (cudzy zasób → 404); dodane wiersze w `api/test/authz`
- [ ] Operacje od 1 000 zł / pracownika / administratora wymagają step-up sprawdzanego w API (`acr`, `auth_time`)
- [ ] Wejście walidowane (DTO `whitelist` + `forbidNonWhitelisted`), kwoty w groszach, brak surowego SQL
- [ ] Brak tokenów, haseł, IBAN-ów i sald w logach, błędach i pamięci trwałej urządzenia
- [ ] Brak sekretów w kodzie i konfiguracji; nowe zmienne opisane w `.env.example`
- [ ] Nowe zależności uzasadnione i sprawdzone (licencja, utrzymanie, `pnpm audit`)
- [ ] Migracje bazy przejrzane (destrukcyjne zmiany? backfill?), stare migracje nieedytowane
- [ ] OpenAPI i typy aplikacji wygenerowane ponownie (`api:openapi:generate`, `app:api:types`)
- [ ] Nowa powierzchnia ataku (link, uprawnienie, WebView, zewnętrzne API, strefa) → zaktualizowany model zagrożeń
- [ ] Zmiany w `infra/`, `.github/`, `.claude/` przejrzane przez osobę odpowiedzialną za DevSecOps

## Uwagi dla recenzenta

<!-- Co jest jeszcze zamockowane, znane ograniczenia, otwarte uwagi z audytu bezpieczeństwa -->
