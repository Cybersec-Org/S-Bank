# Raport z wyników testów – S-Bank

| Moduł | Rodzaj testów | Zestawy | Przypadki | Czas | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Backend (`@sbank/api`)** | Jednostkowe, kontrolera i bezpieczeństwa | 9 | 92 | 2,30 s | **PASS** |
| **Backend (`@sbank/api`)** | Integracyjne współbieżności (`sbank_test`) | 1 | 6 | 1,24 s | **PASS** |
| **Aplikacja (`@sbank/app`)** | Jednostkowe, ekranów i komponentów | 37 | 368 | 12,02 s | **PASS** |
| **Łącznie** | — | **47** | **466** | **15,56 s** | **PASS** |

---

## Backend (`@sbank/api`)

### 1. Testy jednostkowe, kontrolera i bezpieczeństwa

Zweryfikowano macierz uprawnień RBAC/ABAC (`CLIENT`, `EMPLOYEE`, `ADMIN`), ochronę przed BOLA, walidację tokenów OIDC/JWT wraz z `acr=2` (Passkey step-up), blokadę trybu `mock` w produkcji, uwierzytelnianie i izolację partnerów (mTLS) oraz logikę zatwierdzania i anulowania szkiców przelewów (saldo, limity dzienne, status rachunku).

```text
PASS  src/auth/casl-ability.factory.spec.ts
PASS  src/auth/partner-auth.guard.spec.ts
PASS  src/auth/policies.guard.spec.ts
PASS  src/auth/partner-permissions.guard.spec.ts
PASS  src/auth/user-auth.guard.spec.ts
PASS  src/auth/jwt-auth.guard.spec.ts
PASS  src/accounts/accounts.controller.spec.ts
PASS  src/accounts/accounts.transfers.spec.ts
PASS  src/accounts/accounts.service.spec.ts

Test Suites: 9 passed, 9 total
Tests:       92 passed, 92 total
Snapshots:   0 total
Time:        2.296 s
Ran all test suites.
```

### 2. Testy integracyjne współbieżności (PostgreSQL)

Zweryfikowano odporność transakcji finansowych na wyścigi (*race conditions*), podwójne wydatkowanie i zakleszczenia (*deadlocks*) na rzeczywistej instancji PostgreSQL 17.

```text
PASS  src/accounts/accounts.transfers.integration-spec.ts
  AccountsService transfer concurrency (PostgreSQL)
    ✓ should execute the same draft only once when confirmed concurrently (83 ms)
    ✓ should prevent concurrent drafts from spending more than the available balance (32 ms)
    ✓ should allow only one operation when confirmation and cancellation race (28 ms)
    ✓ should prevent concurrent transfers from exceeding the daily limit (32 ms)
    ✓ should handle concurrent transfers in opposite directions without deadlock (35 ms)
    ✓ should pay the same payment request only once when called concurrently (51 ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        1.237 s
Ran all test suites.
```

---

## Aplikacja (`@sbank/app`)

### Testy jednostkowe, ekranów i komponentów

Zweryfikowano ekrany wszystkich ról (klient, pracownik, administrator), przepływy przelewów ze step-up i płatności QR, bezpieczne przechowywanie sesji (native i web), obsługę klienta API oraz błędów RFC 7807, walidatory (IBAN, kwoty groszowe, daty, UUID) oraz komponenty interfejsu.

```text
Test Suites: 37 passed, 37 total
Tests:       368 passed, 368 total
Snapshots:   0 total
Time:        12.017 s
Ran all test suites.
```
