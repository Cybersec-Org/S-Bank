import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import { useApiMode, useIsMockMode } from '@/shared/config/ApiModeProvider';

<<<<<<< HEAD
import { DEV_API_PRINCIPALS } from './dev-api-identity';

=======
>>>>>>> origin/passkeys-and-stepup
import { authenticateWithOidc, isStepUpFresh, signOutFromOidc } from './oidc';
import { hasRole, type AssuranceLevel, type Principal, type Role } from './roles';
import { createSessionStore, type SessionStore } from './session-store';

export interface Session {
  readonly status: 'signedOut' | 'signedIn';
  readonly principal: Principal | null;
  readonly acr: AssuranceLevel | null;
  readonly isStepUpFresh: boolean;
  hasRole: (role: Role) => boolean;
  signInAsMock: (role: Role) => void;
  raiseMockAssurance: () => void;
  signInWithPassword: () => Promise<void>;
  signInWithPasskey: () => Promise<void>;
  stepUpWithPasskey: () => Promise<void>;
  registerPasskey: () => Promise<void>;
  /** Ends the session and drops every cached query, so no financial data outlives it. */
  signOut: () => void;
}

const SessionStoreContext = createContext<SessionStore | null>(null);

interface SessionProviderProps {
  readonly children: ReactNode;
  /** Tests inject a prepared store. */
  readonly store?: SessionStore;
}

export function SessionProvider({ children, store }: SessionProviderProps) {
  const mockEnabled = useIsMockMode();
  const mode = useApiMode();
  const resolvedStore = useMemo(
    () =>
      store ??
      createSessionStore({
        mockEnabled,
        ...(mode === 'hybrid' ? { principals: DEV_API_PRINCIPALS } : {}),
      }),
    [store, mockEnabled, mode],
  );
  return (
    <SessionStoreContext.Provider value={resolvedStore}>{children}</SessionStoreContext.Provider>
  );
}

export function useSessionStore(): SessionStore {
  const store = useContext(SessionStoreContext);
  if (store === null) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return store;
}

export function useSession(): Session {
  const store = useSessionStore();
  const queryClient = useQueryClient();
  const mockEnabled = useIsMockMode();
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const principal = state.status === 'signedIn' ? state.principal : null;

  return useMemo<Session>(
    () => ({
      status: state.status,
      principal,
      acr: principal === null ? null : principal.acr,
      isStepUpFresh: isStepUpFresh(principal),
      hasRole: (role) => hasRole(principal, role),
      signInAsMock: store.signInAsMock,
      raiseMockAssurance: store.raiseMockAssurance,
      signInWithPassword: async () => {
        const tokens = await authenticateWithOidc({ acrValues: '1' });
        store.setOidcSession(tokens);
      },
      signInWithPasskey: async () => {
        const tokens = await authenticateWithOidc({ acrValues: '2' });
        store.setOidcSession(tokens);
      },
      stepUpWithPasskey: async () => {
        const tokens = await authenticateWithOidc({ acrValues: '2' });
        store.setOidcSession(tokens);
      },
      registerPasskey: async () => {
        const tokens = await authenticateWithOidc({ kcAction: 'webauthn-register-passwordless' });
        store.setOidcSession(tokens);
      },
      signOut: () => {
        const current = store.getState();
        const refreshToken = current.status === 'signedIn' ? current.refreshToken : undefined;
        const idToken = current.status === 'signedIn' ? current.idToken : undefined;
        store.signOut();
        queryClient.clear();
        if (!mockEnabled && (refreshToken !== undefined || idToken !== undefined)) {
          void signOutFromOidc({ refreshToken, idToken });
        }
      },
    }),
    [state.status, principal, store, queryClient, mockEnabled],
  );
}
