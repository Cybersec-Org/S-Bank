# SoftHSM2 (B-28) — miejsce zarezerwowane

Ten katalog jest na razie pusty z punktu widzenia stosu: usługa SoftHSM2 nie jest jeszcze częścią `infra/docker-compose.yml`, więc nic nie montuje woluminu `softhsm-tokens` i nie jest on tam zadeklarowany. Zadanie B-28 (SR-11, MASVS-CRYPTO) dodaje usługę razem z woluminem.

## Plan

- Usługa `softhsm` w sieci `internal` (bez opublikowanych portów); API korzysta z niej przez PKCS#11 (moduł `libsofthsm2.so`), podpisuje potwierdzenia przelewów.
- Katalog tokenów (`SOFTHSM2_CONF` → `directories.tokendir`) to nazwany wolumin `softhsm-tokens`. Nigdy nie trafia do repozytorium: `.gitignore` i `.dockerignore` wykluczają `infra/softhsm/tokens/`.
- Klucze generuje skrypt inicjalizacyjny wewnątrz tokenu (`pkcs11-tool --keypairgen` z `--sensitive --private`, bez `--extractable`), czyli jako **nieeksportowalne** (`CKA_EXTRACTABLE=false`, `CKA_SENSITIVE=true`). Klucz prywatny nie opuszcza tokenu; poza HSM istnieje tylko klucz publiczny.
- PIN użytkownika i PIN oficera bezpieczeństwa pochodzą z `.env` (`node scripts/dev-secrets.mjs`), nie z obrazu ani z repozytorium.
- Obraz jak każdy inny w stosie: dokładna wersja i skrót, użytkownik bez uprawnień roota, system plików tylko do odczytu poza woluminem tokenów, `cap_drop: [ALL]`, healthcheck.

## Zakres, którego jeszcze nie ma

Obraz, skrypt inicjalizacji tokenu, zmienne `SOFTHSM_*` w `.env.example` i test, że `C_GetAttributeValue(CKA_VALUE)` na kluczu prywatnym kończy się błędem.
