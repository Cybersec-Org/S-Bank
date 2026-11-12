# D1: Inwentaryzacja danych na urządzeniu (S-Bank)

| Dane | Gdzie są teraz | Klasyfikacja | Musi być na urządzeniu? | Docelowe miejsce i opcja |
| :--- | :--- | :--- | :--- | :--- |
| **Token sesji / tożsamość użytkownika (`x-user-id`, `x-user-role`, docelowo `refresh_token`)** | Pamięć / stan kontekstu aplikacji | Poufne | **Tak** — utrzymanie sesji zalogowanego użytkownika | `expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (Web: tylko pamięć RAM) |
| **Krótkotrwały token dostępu (`access_token`)** | Pamięć RAM | Poufne | **Nie** (nie na dysku) | Tylko pamięć RAM (zmienna w pamięci procesu), brak zapisu na dysk |
| **Rachunki bankowe (`iban`, `balance`, `dailyLimit`, `dailyUsed`, `status`)** | Pamięć RAM (stan komponentów / cache HTTP) | Szczególnie wrażliwe | **Nie** — pobierane z `GET /accounts` | Tylko pamięć RAM, brak zapisu na dysk, czyszczone przy wylogowaniu |
| **Historia transakcji i szkice przelewów (`DRAFT` / `COMPLETED`)** | Pamięć RAM | Szczególnie wrażliwe | **Nie** — pobierane z `GET /accounts/{id}/transactions` | Tylko pamięć RAM, brak lokalnej bazy SQLite |
| **Dane profilu klienta (`firstName`, `lastName`, `email`, `customerNumber`)** | Pamięć RAM | Poufne | **Nie** — pobierane z `GET /customers/me` | Tylko pamięć RAM |
| **Preferencje UI i tryb aplikacji (motyw, flaga pierwszego uruchomienia)** | Pamięć / `AsyncStorage` | Wewnętrzne | **Tak** — zachowanie ustawień interfejsu | `AsyncStorage` (izolacja piaskownicy aplikacji) |
| **Kursy walut NBP i wynik przewalutowania** | Pamięć RAM | Publiczne | **Nie** — pobierane z `GET /public/rates` i `/public/convert` | Pamięć podręczna w RAM |