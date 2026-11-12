# D2: Raport „przed” — co widać na urządzeniu (S-Bank)

| Miejsce | Co znaleziono | Ryzyko |
| :--- | :--- | :--- |
| **Stan sesji / Przełącznik ról (`mock` / `live`)** | Identyfikator użytkownika (`x-user-id`, np. `client-1`) oraz rola (`x-user-role`) przechowywane bez sprzętowego szyfrowania | **Wysokie** |
| **Logi deweloperskie (`logcat` / Console)** | Nagłówki zapytań HTTP oraz odpowiedzi JSON z endpointów `/customers/me` i `/accounts` (jawne numery IBAN i salda) | **Wysokie** |
| **Cache HTTP / Pamięć zapytań** | Zbuforowane odpowiedzi z historią transakcji i danymi osobowymi klienta (`Jan Kowalski`, `CUST-1001`) | **Średnie** |
| **Kopia zapasowa systemu (Android Backup)** | Domyślna konfiguracja pozwalająca na uwzględnienie katalogu danych aplikacji w kopii zapasowej urządzenia | **Średnie** |
| **Przełącznik aplikacji (App Switcher)** | Widoczny podgląd ostatnio otwartego ekranu z saldem rachunku i formularzem przelewu po zminimalizowaniu aplikacji | **Średnie** |