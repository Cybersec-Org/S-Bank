import * as AuthSession from 'expo-auth-session';
import { randomUUID } from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { z } from 'zod';

import { env } from '@/shared/config/env';

import { startAuthorization, takePendingAuthorization } from './oidc-browser';
import type { AssuranceLevel, Principal, Role } from './roles';

WebBrowser.maybeCompleteAuthSession();

export const STEP_UP_MAX_AGE_SECONDS = 300;

export interface OidcTokens {
  readonly accessToken: string;
  readonly idToken?: string | undefined;
  readonly refreshToken?: string | undefined;
}

export interface AuthenticateOidcOptions {
  readonly acrValues?: AssuranceLevel | undefined;
  readonly kcAction?: string | undefined;
  /**
   * Step-up: `prompt=login` + `max_age=0` make Keycloak ask for the Passkey again instead of reusing the SSO
   * session, so the new token carries a fresh `auth_time`.
   */
  readonly forceReauthentication?: boolean | undefined;
  /**
   * Requests the `sbank-passkey-login` scope, which makes the Keycloak browser flow take the Passkey path at LoA 1
   * (no password first). The scope only selects the path; LoA 2 still needs an actual Passkey.
   */
  readonly passkeyLogin?: boolean | undefined;
  /** Web: in-app path to come back to after the redirect (step-up keeps the user on the same screen). */
  readonly returnTo?: string | undefined;
}

export const PASSKEY_LOGIN_SCOPE = 'sbank-passkey-login';

/** The single place that maps token roles (Keycloak realm roles or API enum names) to app roles. */
const ROLE_ALIASES: Readonly<Record<string, Role>> = {
  customer: 'customer',
  CLIENT: 'customer',
  employee: 'employee',
  EMPLOYEE: 'employee',
  admin: 'admin',
  ADMIN: 'admin',
};

const jwtPayloadSchema = z.object({
  sub: z.string().min(1),
  acr: z.string().optional(),
  auth_time: z.number().optional(),
  exp: z.number().optional(),
  name: z.string().optional(),
  preferred_username: z.string().optional(),
  email: z.string().optional(),
  realm_access: z
    .object({
      roles: z.array(z.string()).optional(),
    })
    .optional(),
});

const idTokenPayloadSchema = z.object({
  nonce: z.string().optional(),
});

const discoveryDocumentSchema = z.object({
  issuer: z.string(),
  authorization_endpoint: z.url(),
  token_endpoint: z.url(),
  revocation_endpoint: z.url().optional(),
  end_session_endpoint: z.url().optional(),
});

export type OidcErrorCode = 'cancelled' | 'access_denied' | 'failed' | 'passkey_required';

export class OidcAuthError extends Error {
  readonly code: OidcErrorCode;

  constructor(code: OidcErrorCode, message: string) {
    super(message);
    this.name = 'OidcAuthError';
    this.code = code;
  }
}

function issuerUrl(): string {
  return env.oidcIssuerUrl.replace(/\/$/, '');
}

let discoveryCache: Promise<AuthSession.DiscoveryDocument> | null = null;

/**
 * Endpoints from the issuer's discovery document. The document must name exactly the configured issuer,
 * otherwise sign-in stops: tokens from another issuer would be rejected by the API anyway.
 */
export function getDiscovery(): Promise<AuthSession.DiscoveryDocument> {
  if (discoveryCache !== null) {
    return discoveryCache;
  }
  const pending = AuthSession.fetchDiscoveryAsync(issuerUrl())
    .then((discovery): AuthSession.DiscoveryDocument => {
      const parsed = discoveryDocumentSchema.safeParse(discovery.discoveryDocument);
      if (!parsed.success || parsed.data.issuer.replace(/\/$/, '') !== issuerUrl()) {
        throw new OidcAuthError(
          'failed',
          'Discovery document does not match the configured issuer',
        );
      }
      const { revocation_endpoint: revocation, end_session_endpoint: endSession } = parsed.data;
      return {
        authorizationEndpoint: parsed.data.authorization_endpoint,
        tokenEndpoint: parsed.data.token_endpoint,
        ...(revocation === undefined ? {} : { revocationEndpoint: revocation }),
        ...(endSession === undefined ? {} : { endSessionEndpoint: endSession }),
      };
    })
    .catch((error: unknown) => {
      discoveryCache = null;
      throw error instanceof OidcAuthError
        ? error
        : new OidcAuthError('failed', 'Identity provider unavailable');
    });
  discoveryCache = pending;
  return pending;
}

/** Tests only: forget the cached discovery document. */
export function resetDiscoveryCache(): void {
  discoveryCache = null;
}

function getRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: 'sbank',
    path: 'oauth/callback',
  });
}

function decodeBase64Url(segment: string): string {
  const normalized = segment.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeJwtPayload(token: string): unknown {
  const payloadSegment = token.split('.')[1];
  if (payloadSegment === undefined) {
    throw new Error('Invalid OIDC token format');
  }
  return JSON.parse(decodeBase64Url(payloadSegment));
}

/** Decodes an OIDC access token into a UI `Principal`; the backend remains the security authority. */
export function parseJwtPrincipal(accessToken: string): Principal {
  const payload = jwtPayloadSchema.parse(decodeJwtPayload(accessToken));

  const roles = Array.from(
    new Set(
      (payload.realm_access?.roles ?? [])
        .map((role) => ROLE_ALIASES[role])
        .filter((role): role is Role => role !== undefined),
    ),
  );

  if (roles.length === 0) {
    throw new Error('Token does not contain a supported S-Bank role');
  }

  const displayName =
    payload.name?.trim() ||
    payload.email?.trim() ||
    payload.preferred_username?.trim() ||
    payload.sub;
  const acr: AssuranceLevel = payload.acr === '2' ? '2' : '1';

  return {
    subject: payload.sub,
    displayName,
    roles,
    acr,
    ...(payload.auth_time === undefined ? {} : { authTime: payload.auth_time }),
  };
}

/** `exp` of the access token in epoch milliseconds (for the refresh logic), or undefined. */
export function accessTokenExpiresAt(accessToken: string): number | undefined {
  const parsed = jwtPayloadSchema.safeParse(decodeJwtPayload(accessToken));
  return parsed.success && parsed.data.exp !== undefined ? parsed.data.exp * 1000 : undefined;
}

/**
 * Checks whether the session has an active Passkey LoA (`acr=2`) within the freshness window. Fails closed like
 * the API: without `auth_time` the step-up cannot be proven fresh.
 */
export function isStepUpFresh(
  principal: Principal | null,
  nowEpochSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (principal === null || principal.acr !== '2' || principal.authTime === undefined) {
    return false;
  }
  return nowEpochSeconds - principal.authTime <= STEP_UP_MAX_AGE_SECONDS;
}

/** UI rule matching the API (`PASSKEY_REQUIRED`): employee and admin sessions need `acr=2`. */
export function requiresPasskeyForStaff(principal: Principal): boolean {
  const isStaff = principal.roles.includes('employee') || principal.roles.includes('admin');
  return isStaff && principal.acr !== '2';
}

function verifyNonce(idToken: string | undefined, expected: string): void {
  if (idToken === undefined) {
    throw new OidcAuthError('failed', 'ID token missing');
  }
  const parsed = idTokenPayloadSchema.safeParse(decodeJwtPayload(idToken));
  if (!parsed.success || parsed.data.nonce !== expected) {
    throw new OidcAuthError('failed', 'ID token nonce mismatch');
  }
}

async function exchangeAndVerify(
  discovery: AuthSession.DiscoveryDocument,
  code: string,
  codeVerifier: string | undefined,
  redirectUri: string,
  nonce: string,
): Promise<OidcTokens> {
  const tokenResponse = await AuthSession.exchangeCodeAsync(
    {
      clientId: env.oidcClientId,
      code,
      redirectUri,
      ...(codeVerifier === undefined ? {} : { extraParams: { code_verifier: codeVerifier } }),
    },
    discovery,
  ).catch(() => {
    throw new OidcAuthError('failed', 'Token exchange failed');
  });

  verifyNonce(tokenResponse.idToken, nonce);

  return {
    accessToken: tokenResponse.accessToken,
    ...(tokenResponse.idToken === undefined ? {} : { idToken: tokenResponse.idToken }),
    ...(tokenResponse.refreshToken === undefined
      ? {}
      : { refreshToken: tokenResponse.refreshToken }),
  };
}

function errorFromParams(params: Readonly<Record<string, string | undefined>>): OidcAuthError {
  // Includes `state_mismatch`, which expo-auth-session reports when the returned state differs.
  const code = params.error === 'access_denied' ? 'access_denied' : 'failed';
  return new OidcAuthError(code, 'Authentication failed');
}

/**
 * Signs in through Keycloak. Native: resolves with the tokens when the system browser returns. Web (P-17): the tab
 * navigates to Keycloak and the promise never settles; the sign-in finishes in `completeOidcRedirect` on
 * /oauth/callback after the page comes back.
 */
export async function authenticateWithOidc(
  options: AuthenticateOidcOptions = {},
): Promise<OidcTokens> {
  const discovery = await getDiscovery();
  const redirectUri = getRedirectUri();
  const nonce = randomUUID();
  const extraParams: Record<string, string> = { nonce };
  if (options.acrValues !== undefined) {
    extraParams.acr_values = options.acrValues;
  }
  if (options.kcAction !== undefined) {
    extraParams.kc_action = options.kcAction;
  }
  if (options.forceReauthentication === true) {
    extraParams.max_age = '0';
  }

  const request = new AuthSession.AuthRequest({
    clientId: env.oidcClientId,
    redirectUri,
    scopes: [
      'openid',
      'profile',
      'email',
      ...(options.passkeyLogin === true ? [PASSKEY_LOGIN_SCOPE] : []),
    ],
    usePKCE: true,
    codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    ...(options.forceReauthentication === true ? { prompt: AuthSession.Prompt.Login } : {}),
    extraParams,
  });

  const outcome = await startAuthorization(request, discovery, {
    nonce,
    redirectUri,
    returnTo: options.returnTo,
  });
  if (outcome.kind === 'redirected') {
    return new Promise<OidcTokens>(() => undefined);
  }
  const result = outcome.result;

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new OidcAuthError('cancelled', 'Authentication cancelled');
  }

  if (result.type === 'error') {
    throw errorFromParams(result.params);
  }

  if (result.type !== 'success' || typeof result.params.code !== 'string') {
    throw new OidcAuthError('failed', 'Authorization code missing');
  }

  return exchangeAndVerify(discovery, result.params.code, request.codeVerifier, redirectUri, nonce);
}

export interface CompletedRedirect {
  readonly tokens: OidcTokens;
  readonly returnTo?: string | undefined;
}

/**
 * Web: finishes the sign-in on /oauth/callback after Keycloak redirected the tab back. The `state` in the URL must
 * match the one stored before leaving (single use, 10 minutes); then the code is exchanged with the stored PKCE
 * verifier and the ID token `nonce` is checked.
 */
export async function completeOidcRedirect(callbackUrl: string): Promise<CompletedRedirect> {
  const params = Object.fromEntries(new URL(callbackUrl).searchParams.entries());
  const pending = takePendingAuthorization(params.state);
  if (pending === null) {
    throw new OidcAuthError('failed', 'No matching sign-in in progress (state)');
  }
  if (params.error !== undefined) {
    throw params.error === 'access_denied'
      ? new OidcAuthError('access_denied', 'Authentication failed')
      : errorFromParams(params);
  }
  if (params.code === undefined || params.code === '') {
    throw new OidcAuthError('failed', 'Authorization code missing');
  }
  const discovery = await getDiscovery();
  const tokens = await exchangeAndVerify(
    discovery,
    params.code,
    pending.codeVerifier,
    pending.redirectUri,
    pending.nonce,
  );
  return { tokens, ...(pending.returnTo === undefined ? {} : { returnTo: pending.returnTo }) };
}

/**
 * Ends the Keycloak session. With a refresh token this is a background `POST /logout` (no browser window);
 * without one it falls back to the browser `end_session` redirect with `id_token_hint`. Errors are swallowed:
 * the local session is already cleared before this runs.
 */
export async function signOutFromOidc(
  tokens: {
    readonly refreshToken?: string | undefined;
    readonly idToken?: string | undefined;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const discovery = await getDiscovery().catch(() => null);
  const endSessionEndpoint = discovery?.endSessionEndpoint;
  if (endSessionEndpoint === undefined) {
    return;
  }

  if (tokens.refreshToken !== undefined) {
    await fetchImpl(endSessionEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.oidcClientId,
        refresh_token: tokens.refreshToken,
      }).toString(),
    }).catch(() => undefined);
    return;
  }

  if (tokens.idToken !== undefined) {
    const redirectUri = getRedirectUri();
    const params = new URLSearchParams({
      client_id: env.oidcClientId,
      post_logout_redirect_uri: redirectUri,
      id_token_hint: tokens.idToken,
    });
    await WebBrowser.openAuthSessionAsync(
      `${endSessionEndpoint}?${params.toString()}`,
      redirectUri,
    ).catch(() => undefined);
  }
}
