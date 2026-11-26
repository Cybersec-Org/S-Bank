import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { useApiMode, useIsMockMode } from '@/shared/config/ApiModeProvider';

import { DEV_API_PRINCIPALS } from './dev-api-identity';

import {
  authenticateWithOidc,
  completeOidcRedirect,
  isStepUpFresh,
  OidcAuthError,
  parseJwtPrincipal,
  requiresPasskeyForStaff,
  signOutFromOidc,
  type AuthenticateOidcOptions,
} from './oidc';
import { hasRole, homeRouteFor, type AssuranceLevel, type Principal, type Role } from './roles';
import { createSessionStore, type SessionStore } from './session-store';

export interface Session {
  readonly status: 'signedOut' | 'signedIn';
  readonly principal: Principal | null;
  readonly acr: AssuranceLevel | null;
  readonly isStepUpFresh: boolean;
  hasRole: (role: Role) => boolean;
  signInAsMock: (role: Role) => void;
  raiseMockAssurance: () => void;
  /**
   * LoA 1. Throws `OidcAuthError('passkey_required')` for employee/admin tokens without acr=2 (for example right
   * after the first sign-in that registered the Passkey): staff must sign in with the Passkey.
   */
  signInWithPassword: () => Promise<void>;
  signInWithPasskey: () => Promise<void>;
  /** Fresh Passkey step-up: `acr_values=2`, `prompt=login`, `max_age=0`. */
  stepUpWithPasskey: () => Promise<void>;
  /**
   * Web (P-17): finishes the sign-in on /oauth/callback and returns where to go next – the step-up screen, the
   * role's home route, or the start screen with `?authError=<code>`.
   */
  completeRedirectSignIn: () => Promise<string>;
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

/**
 * Signs in through Keycloak and keeps the session only if the app may show it. A staff token without acr=2 is
 * not kept: its Keycloak session is ended right away and the caller gets `passkey_required`. The API enforces
 * the same rule (403 PASSKEY_REQUIRED); this only keeps the UI honest.
 */
async function signInThroughOidc(
  store: SessionStore,
  options: AuthenticateOidcOptions,
): Promise<void> {
  const tokens = await authenticateWithOidc(options);
  if (requiresPasskeyForStaff(parseJwtPrincipal(tokens.accessToken))) {
    void signOutFromOidc(tokens);
    throw new OidcAuthError('passkey_required', 'Staff must sign in with a Passkey');
  }
  store.setOidcSession(tokens);
}

function currentPath(): string | undefined {
  return Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}`
    : undefined;
}

/** One completion per page load, so a React StrictMode double effect cannot reuse the single-use state. */
let redirectCompletion: Promise<string> | null = null;

function completeRedirect(store: SessionStore): Promise<string> {
  redirectCompletion ??= completeOidcRedirect(window.location.href)
    .then(({ tokens, returnTo }) => {
      const principal = parseJwtPrincipal(tokens.accessToken);
      if (requiresPasskeyForStaff(principal)) {
        void signOutFromOidc(tokens);
        throw new OidcAuthError('passkey_required', 'Staff must sign in with a Passkey');
      }
      store.setOidcSession(tokens);
      return returnTo ?? homeRouteFor(principal);
    })
    .catch((error: unknown) => {
      const code = error instanceof OidcAuthError ? error.code : 'failed';
      return `/?authError=${code}`;
    });
  return redirectCompletion;
}

/** Tests only. */
export function resetRedirectCompletion(): void {
  redirectCompletion = null;
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
      signInWithPassword: () => signInThroughOidc(store, { acrValues: '1' }),
      signInWithPasskey: () => signInThroughOidc(store, { acrValues: '2', passkeyLogin: true }),
      stepUpWithPasskey: () =>
        signInThroughOidc(store, {
          acrValues: '2',
          passkeyLogin: true,
          forceReauthentication: true,
          ...(Platform.OS === 'web' ? { returnTo: currentPath() } : {}),
        }),
      completeRedirectSignIn: () => completeRedirect(store),
      registerPasskey: () =>
        signInThroughOidc(store, { kcAction: 'webauthn-register-passwordless' }),
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
