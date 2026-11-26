import type * as AuthSession from 'expo-auth-session';

/** Everything the redirect target needs to finish a sign-in that left the page (web only). */
export interface PendingAuthorization {
  readonly state: string;
  readonly codeVerifier: string;
  readonly nonce: string;
  readonly redirectUri: string;
  /** In-app path to return to after sign-in (step-up); undefined = the role's home route. */
  readonly returnTo?: string | undefined;
}

export type AuthorizationOutcome =
  | { readonly kind: 'result'; readonly result: AuthSession.AuthSessionResult }
  | { readonly kind: 'redirected' };

/**
 * Native: the system browser (ASWebAuthenticationSession / Custom Tabs) opens over the app and returns the result
 * through the `sbank://oauth/callback` deep link. The web variant (`oidc-browser.web.ts`) redirects the tab instead.
 */
export async function startAuthorization(
  request: AuthSession.AuthRequest,
  discovery: AuthSession.DiscoveryDocument,
  _pending: Omit<PendingAuthorization, 'state' | 'codeVerifier'>,
): Promise<AuthorizationOutcome> {
  return { kind: 'result', result: await request.promptAsync(discovery) };
}

/** Native apps never come back through a full page load, so there is nothing to finish. */
export function takePendingAuthorization(_state: string | undefined): PendingAuthorization | null {
  return null;
}
