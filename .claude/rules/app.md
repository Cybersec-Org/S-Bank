---
paths:
  - 'app/**'
---

# App rules (Expo / React Native / react-native-web)

## Structure

- `src/app/**` holds Expo Router routes only. A route file re-exports a screen: `export { DashboardScreen as default } from '@/features/accounts/screens/DashboardScreen';`. Layouts (`_layout.tsx`) hold navigation, providers and route guards — no business logic.
- `src/features/<feature>/` contains `screens/`, `components/`, `hooks/`, `api/` (repository interface + `*.mock.ts` + `*.http.ts`), `model/` (types, pure functions) and colocated `*.test.tsx`.
- `src/shared/` holds cross-feature code only: `api/` (openapi-fetch client, generated `schema.d.ts`, error mapping, mode switch), `auth/`, `config/`, `i18n/`, `ui/`, `lib/`, `testing/`. A feature never imports another feature's internals; promote shared code to `src/shared` instead.
- Import via the `@/` alias; no deep relative paths (`../../../`).

## Data

- Server state through TanStack Query hooks (`useAccountsQuery`, `useCreateTransferDraftMutation`). Query keys come from one `queryKeys` factory per feature.
- Screens never call `fetch` or the API client directly; hooks call the feature repository.
- Repositories implement an interface and have two implementations: `mock` (deterministic in-memory demo data, small artificial latency) and `http` (generated types from `schema.d.ts`). `EXPO_PUBLIC_API_MODE` picks one in `src/shared/api/repositories.ts`. Mock data contains no real personal data.
- Money is `number` of grosze in code; format only at the edge with `formatMoney` from `src/shared/lib/money.ts`. Never use floats for amounts.
- Financial data lives only in memory (Query cache, no persistence plugin). `gcTime` short for sensitive queries; clear the whole cache on logout.

## UI (mocked until the design is decided)

- Use only primitives from `src/shared/ui` (`Screen`, `Text`, `Button`, `Card`, `TextField`, `MoneyText`, `ListItem`, `EmptyState`, `ErrorState`, `LoadingState`, `MockBadge`) and tokens from `src/shared/ui/theme.ts`. No raw colours, font sizes or spacing values in features.
- Every screen handles loading, empty, error and success states and shows `MockBadge` while running against mock data.
- All copy comes from `src/shared/i18n/pl.ts` (Polish). No hard-coded user-visible strings.
- Accessibility: every touchable has `accessibilityRole` and `accessibilityLabel`; touch targets ≥ 44 px; text scales with system font size; information is never conveyed by colour alone.
- Platform differences go into `*.web.tsx` / `*.native.tsx` files, not `Platform.OS` branches spread through components.

## Security (MASVS-STORAGE, MASVS-PLATFORM, MASVS-AUTH)

- Login only via OIDC Authorization Code + PKCE in the system browser (`expo-auth-session`, `expo-web-browser`). Never a WebView for login, never a password field in the app.
- Refresh token only through `src/shared/auth/secure-storage.ts` (`expo-secure-store` with `requireAuthentication`); web implementation (`secure-storage.web.ts`) keeps it in memory. Access token in memory only. Never `AsyncStorage`, `localStorage` or `sessionStorage` for tokens or financial data.
- UI role guards (`Stack.Protected` / redirects) are convenience only; the API enforces access. Never hide a security check only in the UI.
- Deep links (`/pay/[requestId]`) and QR codes carry only an id; validate its format, require an authenticated session and fetch details from the API before showing a confirmation.
- Ask for camera, location and notification permissions at the moment of use, with a pre-permission explanation; the app keeps working after a denial.
- WebView (terms, help): allowlisted HTTPS origins, `javaScriptEnabled={false}`, no `injectedJavaScript`, no `onMessage` bridge, external links open in the system browser.
- No tokens, IBANs or balances in logs, analytics, error reports or navigation params. Mask IBANs in UI except where the full value is required.
- Mock mode (role switcher, demo data) must be impossible in a production build: guard it with `EXPO_PUBLIC_API_MODE === 'mock'` and a test that asserts the switcher is absent in `live` mode.

## Expo specifics

- Install Expo modules with `npx expo install <pkg>` so versions match the SDK; run `pnpm run app:doctor` after dependency changes.
- Configuration in `app.config.ts` (scheme `sbank`, bundle identifiers, plugins, permission rationale strings in Polish). Read env through `src/shared/config/env.ts` (zod-validated `EXPO_PUBLIC_*`). Only non-secret values may be `EXPO_PUBLIC_*` — they are embedded in the bundle.
- Native folders (`android/`, `ios/`) are generated (CNG) and git-ignored; change native config through config plugins.
