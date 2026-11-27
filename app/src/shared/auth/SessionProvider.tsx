import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
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
import { biometricPreference } from './biometric-preference';
import { biometricVault, type BiometricVault } from './biometric-vault';
import {
  createSessionStore,
  type SessionStore,
  type SignOutReason,
  type UnlockResult,
} from './session-store';

/** Phone biometric unlock (P-18). Always unavailable on the web and in the demo modes. */
export interface BiometricsStatus {
  /** Strong biometrics enrolled on this device. */
  readonly available: boolean;
  /** A session is kept behind biometrics. */
  readonly enabled: boolean;
  /** Offer biometric unlock once, right after a customer signed in on a phone with biometrics. */
  readonly offerPending: boolean;
}

interface BiometricsState {
  readonly available: boolean;
  readonly enabled: boolean;
  readonly asked: boolean;
}

const NO_BIOMETRICS: BiometricsState = { available: false, enabled: false, asked: true };

interface BiometricsContextValue {
  readonly state: BiometricsState;
  readonly update: (patch: Partial<BiometricsState>) => void;
}

const BiometricsContext = createContext<BiometricsContextValue>({
  state: NO_BIOMETRICS,
  update: () => undefined,
});

export interface Session {
  readonly status: 'signedOut' | 'signedIn' | 'locked';
  /** Set when the session ended on its own (expired, refused by the API); null otherwise. */
  readonly signedOutReason: SignOutReason | null;
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
  readonly biometrics: BiometricsStatus;
  /** Phone: biometric prompt → stored refresh token → signed in (TL-17). */
  unlockWithBiometrics: () => Promise<UnlockResult>;
  /** Phone: keep / stop keeping this session behind biometrics. Resolves to the new `enabled` value. */
  setBiometricsEnabled: (enabled: boolean) => Promise<boolean>;
  /** Phone: "not now" for the opt-in offer; it is not shown again. */
  dismissBiometricsOffer: () => void;
}

const SessionStoreContext = createContext<SessionStore | null>(null);

interface SessionProviderProps {
  readonly children: ReactNode;
  /** Tests inject a prepared store. */
  readonly store?: SessionStore;
  /** Tests inject a fake biometric vault (P-18). */
  readonly vault?: BiometricVault;
}

export function SessionProvider({ children, store, vault = biometricVault }: SessionProviderProps) {
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
  const queryClient = useQueryClient();
  const [biometrics, setBiometrics] = useState<BiometricsState>(NO_BIOMETRICS);

  // Phone, live mode: is a session stored behind biometrics? Then start locked ("Unlock with biometrics").
  useEffect(() => {
    if (mockEnabled || Platform.OS === 'web') {
      return;
    }
    let active = true;
    void Promise.all([vault.isAvailable(), vault.isEnabled(), biometricPreference.wasAsked()])
      .then(([available, enabled, asked]) => {
        if (!active) {
          return;
        }
        if (enabled && !available) {
          // Biometrics were removed from the device: the stored key can no longer be read.
          void vault.clear().catch(() => undefined);
        }
        const usable = enabled && available;
        setBiometrics({ available, enabled: usable, asked });
        if (usable && resolvedStore.getState().status === 'signedOut') {
          resolvedStore.lock();
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [mockEnabled, vault, resolvedStore]);

  // Any end of the session – the sign-out button, an expired refresh token, a 401 the API keeps refusing – drops
  // every cached query, so no account, balance or history outlives the session (BASIM4 D5).
  useEffect(
    () =>
      resolvedStore.subscribe(() => {
        if (resolvedStore.getState().status === 'signedOut') {
          queryClient.clear();
          // The store removed the stored session on sign-out (P-18); the next sign-in offers biometrics again.
          setBiometrics((current) => {
            if (!current.enabled) {
              return current;
            }
            void biometricPreference.resetAsked().catch(() => undefined);
            return { ...current, enabled: false, asked: false };
          });
        }
      }),
    [resolvedStore, queryClient],
  );

  const biometricsContext = useMemo<BiometricsContextValue>(
    () => ({
      state: biometrics,
      update: (patch) => setBiometrics((current) => ({ ...current, ...patch })),
    }),
    [biometrics],
  );

  return (
    <SessionStoreContext.Provider value={resolvedStore}>
      <BiometricsContext.Provider value={biometricsContext}>{children}</BiometricsContext.Provider>
    </SessionStoreContext.Provider>
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
  const wasLocked = store.getState().status === 'locked';
  const tokens = await authenticateWithOidc(options);
  if (wasLocked) {
    // Signed in another way instead of unlocking: the stored session (maybe of someone else) must not come back.
    await store.disableBiometrics().catch(() => undefined);
  }
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
  const mockEnabled = useIsMockMode();
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const principal = state.status === 'signedIn' ? state.principal : null;
  const signedOutReason = state.status === 'signedOut' ? (state.reason ?? null) : null;
  const { state: bio, update: updateBiometrics } = useContext(BiometricsContext);
  const offerPending =
    bio.available &&
    !bio.enabled &&
    !bio.asked &&
    state.status === 'signedIn' &&
    hasRole(principal, 'customer');

  return useMemo<Session>(
    () => ({
      status: state.status,
      signedOutReason,
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
        // SessionProvider's store subscription drops every cached query on this transition.
        store.signOut();
        if (!mockEnabled && (refreshToken !== undefined || idToken !== undefined)) {
          void signOutFromOidc({ refreshToken, idToken });
        }
      },
      biometrics: { available: bio.available, enabled: bio.enabled, offerPending },
      unlockWithBiometrics: async () => {
        const result = await store.unlockWithBiometrics();
        if (result === 'unavailable' || result === 'session_expired') {
          updateBiometrics({ enabled: false });
        }
        return result;
      },
      setBiometricsEnabled: async (enabled) => {
        if (enabled) {
          const ok = await store.enableBiometrics();
          if (ok) {
            updateBiometrics({ enabled: true, asked: true });
            void biometricPreference.markAsked().catch(() => undefined);
          }
          return ok;
        }
        await store.disableBiometrics().catch(() => undefined);
        updateBiometrics({ enabled: false });
        return false;
      },
      dismissBiometricsOffer: () => {
        updateBiometrics({ asked: true });
        void biometricPreference.markAsked().catch(() => undefined);
      },
    }),
    [
      state.status,
      signedOutReason,
      principal,
      store,
      mockEnabled,
      bio.available,
      bio.enabled,
      offerPending,
      updateBiometrics,
    ],
  );
}
