# Analiza uprawnień mobilnych (S-Bank)

Dokument zawiera zestawienie uprawnień systemowych wykorzystywanych w aplikacji mobilnej S-Bank, uzasadnienie ich użycia, scenariusze żądania zgody (zasada *Just-in-Time*), obsługę odmowy oraz analizę alternatyw.

---

## 1. Zestawienie uprawnień (Po co, kiedy i odmowa)

| Uprawnienie | Po co? | Kiedy pytanie? | Odmowa |
| :--- | :--- | :--- | :--- |
| **Kamera** | Do skanowania kodu QR zawierającego żądanie płatności. | W momencie skanowania kodu. | Informacja, że skaner jest wymagany do płatności QR, oraz opcjonalny `intent` kierujący do ustawień systemowych aplikacji. |
| **Lokalizacja** | Do znalezienia i posortowania najbliższych bankomatów. | W momencie przejścia na zakładkę z mapą bankomatów. | Uzasadnienie, że lokalizacja służy wyłącznie do określenia pozycji na mapie dla wygody użytkownika, z możliwością ręcznego wyboru z listy. |
| **Powiadomienia** | Do wysyłania powiadomień o statusie przelewu i alertów bezpieczeństwa. | Przy pierwszym uruchomieniu aplikacji po zalogowaniu. | Informacja o braku natychmiastowych powiadomień o transakcjach; aplikacja działa dalej, użytkownik sprawdza status w historii. |

---

## 2. Mapowanie bibliotek Expo na uprawnienia systemowe (AndroidManifest.xml / Info.plist)

| Biblioteka Expo | Uprawnienia (Android) | Uprawnienia (iOS) |
| :--- | :--- | :--- |
| `expo-camera` | `CAMERA` | `NSCameraUsageDescription` |
| `expo-location` | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | `NSLocationWhenInUseUsageDescription` |
| `expo-notifications` | `POST_NOTIFICATIONS` (Android 13+) | `NSUserNotificationsUsageDescription` |

---

## 3. Analiza alternatyw i zasadność uprawnień

| Uprawnienie | Uzasadnienie i ocena alternatyw |
| :--- | :--- |
| **GPS (Lokalizacja)** | Można by teoretycznie zrezygnować całkowicie z lokalizacji GPS na rzecz ręcznego wybierania miast/regionów i statycznych pinezek, jednak obniża to komfort użytkowania bankowości mobilnej. Rozwiązanie hybrydowe (pytanie tylko przy mapie) jest optymalne. |
| **Kamera** | W teorii można polegać na systemowych okienkach ograniczonego dostępu lub mechanizmach selekcji plików/zdjęć z galerii, jednak w praktyce dla natychmiastowego skanowania kodu QR płatności jest to niepraktyczne i mniej bezpieczne niż bezpośredni podgląd z kamery w locie. |