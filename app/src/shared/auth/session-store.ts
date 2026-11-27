import { BiometricCancelled } from './biometric-errors';
import { biometricVault, type BiometricVault, type VaultKey } from './biometric-vault';
import { MOCK_PRINCIPALS } from './mock-principals';
import {
  accessTokenExpiresAt,
  OidcAuthError,
  parseJwtPrincipal,
  refreshTokens as refreshTokensWithKeycloak,
  type OidcTokens,
} from './oidc';
import type { AssuranceLevel, Principal, Role } from './roles';
import { secureStorage } from './secure-storage';
import { SECURE_STORAGE_KEYS } from './secure-storage.types';

/** Key used by an earlier build that wrote the refresh token right after sign-in; still removed on sign-out. */
const LEGACY_REFRESH_TOKEN_KEY = 'sbank_refresh_token';

/**
 * Removes any refresh token left in the Keychain / Keystore. Since stage 9 the refresh token lives only in memory
 * until the biometric opt-in of stage 11 (P-09), so this only cleans up entries from older builds.
 */
async function clearPersistedRefreshToken(): Promise<void> {
  await Promise.all([
    secureStorage.deleteItem(SECURE_STORAGE_KEYS.refreshToken),
    secureStorage.deleteItem(LEGACY_REFRESH_TOKEN_KEY),
  ]);
}

/**
 * Why the session ended without the user pressing "Sign out": `session_expired` – Keycloak refused the refresh
 * token (idle/max time, killed by an administrator, reuse); `access_rejected` – the API refused a fresh token
 * (e.g. no customer linked to this login, role removed).
 */
export type SignOutReason = 'session_expired' | 'access_rejected';

export type SessionState =
  | { readonly status: 'signedOut'; readonly reason?: SignOutReason | undefined }
  /** Phone: a biometric-protected refresh token is stored (P-18); nothing is in memory until the user unlocks. */
  | { readonly status: 'locked' }
  | {
      readonly status: 'signedIn';
      readonly principal: Principal;
      readonly accessToken?: string | undefined;
      readonly idToken?: string | undefined;
      readonly refreshToken?: string | undefined;
      /** `exp` of the access token in epoch milliseconds (live mode). */
      readonly expiresAt?: number | undefined;
    };

type Listener = () => void;

export interface SessionStore {
  getState: () => SessionState;
  getAccessToken: () => string | null;
  subscribe: (listener: Listener) => () => void;
  /** Mock mode only: signs in as a demo identity. Throws when mock mode is off. */
  signInAsMock: (role: Role) => void;
  /** Mock mode only: simulates a successful passkey step-up (acr=2 with a fresh auth_time). */
  raiseMockAssurance: () => void;
  /** Live OIDC mode: keeps the tokens and the decoded principal in memory only (SR-09). */
  setOidcSession: (tokens: OidcTokens) => void;
  /**
   * Live OIDC mode: one shared refresh-token grant for every caller (single-flight), so concurrent 401s never send
   * the same – already rotated – refresh token twice (which would make Keycloak revoke the session).
   * `true` = new tokens are in memory. A refusal by Keycloak signs out with `session_expired`; a network error
   * keeps the session and returns `false`.
   */
  refresh: () => Promise<boolean>;
  signOut: (reason?: SignOutReason) => void;
  /** Phone (P-18): a stored session exists – show "Unlock with biometrics" instead of the sign-in buttons. */
  lock: () => void;
  /** Phone (P-18): biometric prompt → stored refresh token → refresh grant → signed in. */
  unlockWithBiometrics: () => Promise<UnlockResult>;
  /** Phone (P-18): keep this session's refresh token behind biometrics (Android shows one prompt). */
  enableBiometrics: () => Promise<boolean>;
  /** Removes the stored session and the preference. */
  disableBiometrics: () => Promise<void>;
}

/**
 * `unlocked` – signed in; `cancelled` – prompt cancelled, still locked; `unavailable` – stored session unusable
 * (biometrics changed, entries missing) and removed; `session_expired` – Keycloak refused the stored token, removed;
 * `failed` – no answer from Keycloak, still locked.
 */
export type UnlockResult = 'unlocked' | 'cancelled' | 'unavailable' | 'session_expired' | 'failed';

interface SessionStoreOptions {
  readonly mockEnabled: boolean;
  /** Demo identities offered by `signInAsMock`; hybrid mode passes the dev API's seeded users. */
  readonly principals?: Readonly<Record<Role, Principal>>;
  /** Clock in epoch milliseconds; tests inject a fixed one. */
  readonly now?: () => number;
  /** Refresh-token grant; tests inject a fake. */
  readonly refreshTokens?: (refreshToken: string) => Promise<OidcTokens>;
  /** Biometric storage of the refresh token (P-18); tests inject a fake. */
  readonly vault?: BiometricVault;
}

const STEP_UP_LEVEL: AssuranceLevel = '2';

export function createSessionStore({
  mockEnabled,
  principals = MOCK_PRINCIPALS,
  now = Date.now,
  refreshTokens = refreshTokensWithKeycloak,
  vault = biometricVault,
}: SessionStoreOptions): SessionStore {
  let state: SessionState = { status: 'signedOut' };
  let refreshing: Promise<boolean> | null = null;
  /** P-18: the biometric key of this session (after enabling or unlocking); in memory only. */
  let vaultKey: VaultKey | null = null;
  const listeners = new Set<Listener>();

  function setState(next: SessionState): void {
    state = next;
    listeners.forEach((listener) => listener());
  }

  function setOidcSession(tokens: OidcTokens): void {
    const principal = parseJwtPrincipal(tokens.accessToken);
    setState({
      status: 'signedIn',
      principal,
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      refreshToken: tokens.refreshToken,
      expiresAt: accessTokenExpiresAt(tokens.accessToken),
    });
    // P-18: every rotated refresh token replaces the sealed copy (no prompt), so the stored one is never stale.
    if (vaultKey !== null && tokens.refreshToken !== undefined) {
      void vault.seal(vaultKey, tokens.refreshToken).catch(() => undefined);
    }
  }

  function signOut(reason?: SignOutReason): void {
    if (!mockEnabled) {
      vaultKey = null;
      void clearPersistedRefreshToken().catch(() => undefined);
      void vault.clear().catch(() => undefined);
    }
    setState(reason === undefined ? { status: 'signedOut' } : { status: 'signedOut', reason });
  }

  async function unlockWithBiometrics(): Promise<UnlockResult> {
    if (state.status !== 'locked') {
      return state.status === 'signedIn' ? 'unlocked' : 'unavailable';
    }
    let opened;
    try {
      opened = await vault.unlock();
    } catch (error) {
      return error instanceof BiometricCancelled ? 'cancelled' : 'failed';
    }
    if (opened === null) {
      await vault.clear().catch(() => undefined);
      setState({ status: 'signedOut' });
      return 'unavailable';
    }
    let tokens: OidcTokens;
    try {
      tokens = await refreshTokens(opened.refreshToken);
    } catch (error) {
      if (error instanceof OidcAuthError && error.code === 'session_expired') {
        signOut('session_expired');
        return 'session_expired';
      }
      return 'failed';
    }
    if (state.status !== 'locked') {
      return 'failed';
    }
    vaultKey = opened.key;
    setOidcSession(tokens);
    return 'unlocked';
  }

  async function enableBiometrics(): Promise<boolean> {
    if (mockEnabled || state.status !== 'signedIn' || state.refreshToken === undefined) {
      return false;
    }
    try {
      vaultKey = await vault.enable(state.refreshToken);
      return true;
    } catch {
      vaultKey = null;
      await vault.clear().catch(() => undefined);
      return false;
    }
  }

  async function disableBiometrics(): Promise<void> {
    vaultKey = null;
    await vault.clear();
  }

  async function runRefresh(): Promise<boolean> {
    const current = state;
    if (current.status !== 'signedIn' || current.refreshToken === undefined) {
      return false;
    }
    try {
      const tokens = await refreshTokens(current.refreshToken);
      // Signed out (or a different session started) while the grant was in flight: drop the result.
      if (state !== current) {
        return false;
      }
      setOidcSession(tokens);
      return true;
    } catch (error) {
      if (error instanceof OidcAuthError && error.code === 'session_expired' && state === current) {
        signOut('session_expired');
      }
      return false;
    }
  }

  function requireMock(): void {
    if (!mockEnabled) {
      throw new Error('Mock sign-in is disabled outside mock mode');
    }
  }

  return {
    getState: () => state,
    getAccessToken: () => (state.status === 'signedIn' ? (state.accessToken ?? null) : null),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    signInAsMock: (role) => {
      requireMock();
      setState({ status: 'signedIn', principal: principals[role] });
    },
    raiseMockAssurance: () => {
      requireMock();
      if (state.status === 'signedIn') {
        setState({
          ...state,
          principal: {
            ...state.principal,
            acr: STEP_UP_LEVEL,
            authTime: Math.floor(now() / 1000),
          },
        });
      }
    },
    setOidcSession,
    refresh: () => {
      refreshing ??= runRefresh().finally(() => {
        refreshing = null;
      });
      return refreshing;
    },
    signOut,
    lock: () => {
      if (!mockEnabled && state.status !== 'locked') {
        // Tokens and the biometric key leave memory; the sealed refresh token stays for the next unlock.
        vaultKey = null;
        setState({ status: 'locked' });
      }
    },
    unlockWithBiometrics,
    enableBiometrics,
    disableBiometrics,
  };
}
