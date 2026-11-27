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
}

interface SessionStoreOptions {
  readonly mockEnabled: boolean;
  /** Demo identities offered by `signInAsMock`; hybrid mode passes the dev API's seeded users. */
  readonly principals?: Readonly<Record<Role, Principal>>;
  /** Clock in epoch milliseconds; tests inject a fixed one. */
  readonly now?: () => number;
  /** Refresh-token grant; tests inject a fake. */
  readonly refreshTokens?: (refreshToken: string) => Promise<OidcTokens>;
}

const STEP_UP_LEVEL: AssuranceLevel = '2';

export function createSessionStore({
  mockEnabled,
  principals = MOCK_PRINCIPALS,
  now = Date.now,
  refreshTokens = refreshTokensWithKeycloak,
}: SessionStoreOptions): SessionStore {
  let state: SessionState = { status: 'signedOut' };
  let refreshing: Promise<boolean> | null = null;
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
  }

  function signOut(reason?: SignOutReason): void {
    if (!mockEnabled) {
      void clearPersistedRefreshToken().catch(() => undefined);
    }
    setState(reason === undefined ? { status: 'signedOut' } : { status: 'signedOut', reason });
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
  };
}
