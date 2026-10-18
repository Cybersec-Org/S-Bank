import { MOCK_PRINCIPALS } from './mock-principals';
import type { AssuranceLevel, Principal, Role } from './roles';

export type SessionState =
  { readonly status: 'signedOut' } | { readonly status: 'signedIn'; readonly principal: Principal };

type Listener = () => void;

export interface SessionStore {
  getState: () => SessionState;
  subscribe: (listener: Listener) => () => void;
  /** Mock mode only: signs in as a demo identity. Throws when mock mode is off. */
  signInAsMock: (role: Role) => void;
  /** Mock mode only: simulates a successful passkey step-up. */
  raiseMockAssurance: () => void;
  signOut: () => void;
}

interface SessionStoreOptions {
  readonly mockEnabled: boolean;
}

const STEP_UP_LEVEL: AssuranceLevel = '2';

/**
 * In-memory session. It never persists anything and holds no tokens yet (B-10, B-14 add them).
 * The mock entry points refuse to work unless the store was created for mock mode.
 */
export function createSessionStore({ mockEnabled }: SessionStoreOptions): SessionStore {
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
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    signInAsMock: (role) => {
      requireMock();
      setState({ status: 'signedIn', principal: MOCK_PRINCIPALS[role] });
    },
    raiseMockAssurance: () => {
      requireMock();
      if (state.status === 'signedIn') {
        setState({ status: 'signedIn', principal: { ...state.principal, acr: STEP_UP_LEVEL } });
      }
    },
    signOut: () => {
      setState({ status: 'signedOut' });
    },
  };
}
