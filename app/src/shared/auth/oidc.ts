import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { z } from 'zod';

import { env } from '@/shared/config/env';

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
}

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
  name: z.string().optional(),
  preferred_username: z.string().optional(),
  email: z.string().optional(),
  realm_access: z
    .object({
      roles: z.array(z.string()).optional(),
    })
    .optional(),
});

function getDiscoveryDocument(): AuthSession.DiscoveryDocument {
  const issuer = env.oidcIssuerUrl.replace(/\/$/, '');
  return {
    authorizationEndpoint: `${issuer}/protocol/openid-connect/auth`,
    tokenEndpoint: `${issuer}/protocol/openid-connect/token`,
    revocationEndpoint: `${issuer}/protocol/openid-connect/revoke`,
    endSessionEndpoint: `${issuer}/protocol/openid-connect/logout`,
  };
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

/** Decodes an OIDC access token into a UI `Principal`; the backend remains the security authority. */
export function parseJwtPrincipal(accessToken: string): Principal {
  const parts = accessToken.split('.');
  const payloadSegment = parts[1];
  if (payloadSegment === undefined) {
    throw new Error('Invalid OIDC token format');
  }
  const rawJson: unknown = JSON.parse(decodeBase64Url(payloadSegment));
  const payload = jwtPayloadSchema.parse(rawJson);

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
    payload.name?.trim() || payload.email?.trim() || payload.preferred_username?.trim() || payload.sub;
  const acr: AssuranceLevel = payload.acr === '2' ? '2' : '1';

  return {
    subject: payload.sub,
    displayName,
    roles,
    acr,
    ...(payload.auth_time === undefined ? {} : { authTime: payload.auth_time }),
  };
}

/** Checks whether the session has an active Passkey LoA (`acr=2`) within the freshness window. */
export function isStepUpFresh(
  principal: Principal | null,
  nowEpochSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (principal === null || principal.acr !== '2') {
    return false;
  }
  if (principal.authTime === undefined) {
    return true;
  }
  return nowEpochSeconds - principal.authTime <= STEP_UP_MAX_AGE_SECONDS;
}

export class OidcAuthError extends Error {
  readonly code: 'cancelled' | 'access_denied' | 'failed';

  constructor(code: 'cancelled' | 'access_denied' | 'failed', message: string) {
    super(message);
    this.name = 'OidcAuthError';
    this.code = code;
  }
}

export async function authenticateWithOidc(
  options: AuthenticateOidcOptions = {},
): Promise<OidcTokens> {
  const discovery = getDiscoveryDocument();
  const redirectUri = getRedirectUri();
  const extraParams: Record<string, string> = {};
  if (options.acrValues !== undefined) {
    extraParams.acr_values = options.acrValues;
  }
  if (options.kcAction !== undefined) {
    extraParams.kc_action = options.kcAction;
  }

  const request = new AuthSession.AuthRequest({
    clientId: env.oidcClientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    usePKCE: true,
    codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    extraParams,
  });

  const result = await request.promptAsync(discovery);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new OidcAuthError('cancelled', 'Authentication cancelled');
  }

  if (result.type === 'error') {
    const errorCode = result.params.error === 'access_denied' ? 'access_denied' : 'failed';
    throw new OidcAuthError(errorCode, result.error?.message ?? 'Authentication failed');
  }

  if (result.type !== 'success' || typeof result.params.code !== 'string') {
    throw new OidcAuthError('failed', 'Authorization code missing');
  }

  const tokenResponse = await AuthSession.exchangeCodeAsync(
    {
      clientId: env.oidcClientId,
      code: result.params.code,
      redirectUri,
      ...(request.codeVerifier === undefined
        ? {}
        : { extraParams: { code_verifier: request.codeVerifier } }),
    },
    discovery,
  );

  return {
    accessToken: tokenResponse.accessToken,
    ...(tokenResponse.idToken === undefined ? {} : { idToken: tokenResponse.idToken }),
    ...(tokenResponse.refreshToken === undefined
      ? {}
      : { refreshToken: tokenResponse.refreshToken }),
  };
}

export async function signOutFromOidc(tokens: {
  readonly refreshToken?: string | undefined;
  readonly idToken?: string | undefined;
}): Promise<void> {
  const discovery = getDiscoveryDocument();
  const redirectUri = getRedirectUri();

  if (tokens.refreshToken !== undefined && discovery.revocationEndpoint !== undefined) {
    await AuthSession.revokeAsync(
      {
        clientId: env.oidcClientId,
        token: tokens.refreshToken,
      },
      discovery,
    ).catch(() => undefined);
  }

  if (discovery.endSessionEndpoint !== undefined) {
    const params = new URLSearchParams({
      client_id: env.oidcClientId,
      post_logout_redirect_uri: redirectUri,
      ...(tokens.idToken === undefined ? {} : { id_token_hint: tokens.idToken }),
    });
    const logoutUrl = `${discovery.endSessionEndpoint}?${params.toString()}`;
    await WebBrowser.openAuthSessionAsync(logoutUrl, redirectUri).catch(() => undefined);
  }
}
