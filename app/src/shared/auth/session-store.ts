import { MOCK_PRINCIPALS } from './mock-principals';
import { parseJwtPrincipal, type OidcTokens } from './oidc';
import type { AssuranceLevel, Principal, Role } from './roles';

const REFRESH_TOKEN_STORAGE_KEY = 'sbank_refresh_token';

async function persistRefreshToken(token: string): Promise<void> {
  const { secureStorage } = await import('./secure-storage');
  await secureStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
}

async function clearRefreshToken(): Promise<void> {
  const { secureStorage } = await import('./secure-storage');
  await secureStorage.deleteItem(REFRESH_TOKEN_STORAGE_KEY);
}

export type SessionState =
  | { readonly status: 'signedOut' }
  | {
      readonly status: 'signedIn';
      readonly principal: Principal;
      readonly accessToken?: string | undefined;
      readonly idToken?: string | undefined;
      readonly refreshToken?: string | undefined;
    };

type Listener = () => void;

export interface SessionStore {
  getState: () => SessionState;
  getAccessToken: () => string | null;
  subscribe: (listener: Listener) => () => void;
  /** Mock mode only: signs in as a demo identity. Throws when mock mode is off. */
  signInAsMock: (role: Role) => void;
  /** Mock mode only: simulates a successful passkey step-up. */
  raiseMockAssurance: () => void;
  /** Live OIDC mode: stores verified tokens and decoded principal in memory (refresh token in SecureStore on native). */
  setOidcSession: (tokens: OidcTokens) => void;
  signOut: () => void;
}

interface SessionStoreOptions {
  readonly mockEnabled: boolean;
  /** Demo identities offered by `signInAsMock`; hybrid mode passes the dev API's seeded users. */
  readonly principals?: Readonly<Record<Role, Principal>>;
}

const STEP_UP_LEVEL: AssuranceLevel = '2';

<<<<<<< HEAD
/**
 * In-memory session. It never persists anything and holds no tokens yet (B-10, B-14 add them).
 * The mock entry points refuse to work unless the store was created for mock mode.
 */
export function createSessionStore({
  mockEnabled,
  principals = MOCK_PRINCIPALS,
}: SessionStoreOptions): SessionStore {
=======
export function createSessionStore({ mockEnabled }: SessionStoreOptions): SessionStore {
>>>>>>> origin/passkeys-and-stepup
  let state: SessionState = { status: 'signedOut' };
  const listeners = new Set<Listener>();

  function setState(next: SessionState): void {
    state = next;
    listeners.forEach((listener) => listener());
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
          principal: { ...state.principal, acr: STEP_UP_LEVEL },
        });
      }
    },
    setOidcSession: (tokens) => {
      const principal = parseJwtPrincipal(tokens.accessToken);
      if (!mockEnabled && tokens.refreshToken !== undefined) {
        void persistRefreshToken(tokens.refreshToken).catch(() => undefined);
      }
      setState({
        status: 'signedIn',
        principal,
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        refreshToken: tokens.refreshToken,
      });
    },
    signOut: () => {
      if (!mockEnabled) {
        void clearRefreshToken().catch(() => undefined);
      }
      setState({ status: 'signedOut' });
    },
  };
}
