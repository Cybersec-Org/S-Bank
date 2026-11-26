import type * as AuthSession from 'expo-auth-session';
import { z } from 'zod';

import type { AuthorizationOutcome, PendingAuthorization } from './oidc-browser';

export type { AuthorizationOutcome, PendingAuthorization } from './oidc-browser';

/**
 * Web sign-in in the same tab (P-17): the page navigates to Keycloak and comes back to /oauth/callback with a full
 * page load, so the PKCE verifier, `state` and `nonce` must survive that reload. They are kept in sessionStorage
 * (this tab only, cleared when the tab closes) for at most 10 minutes and removed on the first read. Tokens are
 * never stored there: they exist only in memory after the callback (SR-09).
 */
const STORAGE_KEY = 'sbank.oidc.pending';
const MAX_AGE_MS = 10 * 60 * 1000;

const storedSchema = z.object({
  state: z.string().min(1),
  codeVerifier: z.string().min(43),
  nonce: z.string().min(1),
  redirectUri: z.string().min(1),
  returnTo: z.string().optional(),
  createdAt: z.number(),
});

/** Only same-app paths: `/transfer/123` yes, `//evil.example` or `https://…` no (no open redirect). */
export function isSafeReturnPath(path: string | undefined): path is string {
  return (
    path !== undefined && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\')
  );
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export async function startAuthorization(
  request: AuthSession.AuthRequest,
  discovery: AuthSession.DiscoveryDocument,
  pending: Omit<PendingAuthorization, 'state' | 'codeVerifier'>,
  navigate: (url: string) => void = (url) => window.location.assign(url),
  now: () => number = Date.now,
): Promise<AuthorizationOutcome> {
  const url = await request.makeAuthUrlAsync(discovery);
  const store = storage();
  if (store === null || request.codeVerifier === undefined) {
    throw new Error('Sign-in needs sessionStorage in this browser');
  }
  const entry = {
    state: request.state,
    codeVerifier: request.codeVerifier,
    nonce: pending.nonce,
    redirectUri: pending.redirectUri,
    ...(isSafeReturnPath(pending.returnTo) ? { returnTo: pending.returnTo } : {}),
    createdAt: now(),
  };
  store.setItem(STORAGE_KEY, JSON.stringify(entry));
  navigate(url);
  return { kind: 'redirected' };
}

/**
 * Returns the pending sign-in only if `state` matches, and removes it in any case, so a callback URL can be used at
 * most once. A missing, stale (> 10 min) or foreign entry yields null.
 */
export function takePendingAuthorization(
  state: string | undefined,
  now: () => number = Date.now,
): PendingAuthorization | null {
  const store = storage();
  if (store === null) {
    return null;
  }
  const raw = store.getItem(STORAGE_KEY);
  store.removeItem(STORAGE_KEY);
  if (raw === null || state === undefined) {
    return null;
  }
  let parsed: z.infer<typeof storedSchema>;
  try {
    parsed = storedSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
  if (parsed.state !== state || now() - parsed.createdAt > MAX_AGE_MS || parsed.createdAt > now()) {
    return null;
  }
  return {
    state: parsed.state,
    codeVerifier: parsed.codeVerifier,
    nonce: parsed.nonce,
    redirectUri: parsed.redirectUri,
    ...(isSafeReturnPath(parsed.returnTo) ? { returnTo: parsed.returnTo } : {}),
  };
}
