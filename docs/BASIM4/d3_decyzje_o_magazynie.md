# D3: Decyzje o magazynie (S-Bank)

| Dane | Wybrany magazyn | Opcja dostępności / Konfiguracja | Uzasadnienie |
| :--- | :--- | :--- | :--- |
| **Dane sesyjne (`refresh_token` / poświadczenie sesji)** | `expo-secure-store` (iOS Keychain / Android Keystore) | `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` | Dane pozwalające na wznowienie sesji muszą być chronione sprzętowo w Keychain/Keystore i wykluczone z kopii zapasowych (`THIS_DEVICE_ONLY`). W wersji Web trzymane wyłącznie w RAM. |
| **Bieżący token autoryzacji (`access_token` / nagłówki sesji)** | Pamięć RAM | Brak zapisu na dysk | Krótko żyjące dane autoryzacyjne trzymane wyłącznie w pamięci operacyjnej znikają natychmiast po zamknięciu procesu aplikacji. |
| **Rachunki (`Account`), przelewy (`Transaction`) i profil (`Customer`)** | Pamięć RAM | Brak persistencji na dysk, czyszczenie przy wylogowaniu | Dane szczególnie wrażliwe (finansowe i osobowe). Zgodnie z zasadą minimalizacji danych aplikacja pobiera je z API (`GET /customers/me`, `GET /accounts`) i nigdy nie zapisuje na dysku urządzenia. |
| **Preferencje UI i flaga `hasRunBefore`** | `@react-native-async-storage/async-storage` | Domyślna izolacja piaskownicy (Sandbox) | Dane wewnętrzne (ustawienia widoku, flaga wykrywająca reinstalację aplikacji na iOS) nie zawierają żadnych sekretów ani danych osobowych. |