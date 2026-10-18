import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import { useIsMockMode } from '@/shared/config/ApiModeProvider';

import { hasRole, type AssuranceLevel, type Principal, type Role } from './roles';
import { createSessionStore, type SessionStore } from './session-store';

export interface Session {
  readonly status: 'signedOut' | 'signedIn';
  readonly principal: Principal | null;
  readonly acr: AssuranceLevel | null;
  hasRole: (role: Role) => boolean;
  signInAsMock: (role: Role) => void;
  raiseMockAssurance: () => void;
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
  const resolvedStore = useMemo(
    () => store ?? createSessionStore({ mockEnabled }),
    [store, mockEnabled],
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
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const principal = state.status === 'signedIn' ? state.principal : null;

  return useMemo<Session>(
    () => ({
      status: state.status,
      principal,
      acr: principal === null ? null : principal.acr,
      hasRole: (role) => hasRole(principal, role),
      signInAsMock: store.signInAsMock,
      raiseMockAssurance: store.raiseMockAssurance,
      signOut: () => {
        store.signOut();
        queryClient.clear();
      },
    }),
    [state.status, principal, store, queryClient],
  );
}
