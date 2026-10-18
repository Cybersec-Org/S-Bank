import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JSONWebKeySet,
  jwtVerify,
  SignJWT,
} from 'jose';
import { UnauthorizedException } from '@nestjs/common';
import { ROLES, type Principal, type Role } from '../../src/security/auth/principal.js';
import type { TokenVerifier } from '../../src/security/auth/token-verifier.js';
import { FIXED_NOW_SECONDS } from './factories.js';

export const TEST_ISSUER = 'https://localhost/auth/realms/sbank';
export const TEST_AUDIENCE = 'sbank-api';

const TEST_KEY_ID = 'test-key-1';
const TEST_ALGORITHM = 'RS256';
const ACCESS_TOKEN_LIFETIME_SECONDS = 300;
const CLOCK_TOLERANCE_SECONDS = 5;

export interface TestTokenClaims {
  readonly subject?: string;
  readonly roles?: readonly Role[];
  readonly acr?: string;
  readonly authTime?: number;
  readonly issuer?: string;
  readonly audience?: string;
  readonly issuedAt?: number;
  readonly expiresAt?: number;
}

export interface TestTokenIssuer {
  /** Verifier backed by the local JWKS; stands in for the real verifier (B-11) in e2e tests. */
  readonly verifier: TokenVerifier;
  /** Signs a token with the test key. Defaults are valid at the fixed test clock. */
  issue(claims?: TestTokenClaims): Promise<string>;
  /** The public key as a JWKS document, for tokens forged with it as an HMAC secret. */
  readonly jwks: JSONWebKeySet;
}

/** Principal fields from Keycloak-style claims; anything unexpected becomes a rejection. */
function principalFromPayload(payload: Record<string, unknown>): Principal {
  const realmAccess = payload['realm_access'];
  const claimedRoles =
    typeof realmAccess === 'object' && realmAccess !== null && 'roles' in realmAccess
      ? realmAccess.roles
      : [];
  const roles = Array.isArray(claimedRoles)
    ? ROLES.filter((role) => claimedRoles.includes(role))
    : [];
  const { sub, acr, auth_time: authTime } = payload;
  if (typeof sub !== 'string') {
    throw new UnauthorizedException();
  }
  return {
    subject: sub,
    roles,
    ...(typeof acr === 'string' && { acr }),
    ...(typeof authTime === 'number' && { authTime }),
  };
}

/** Generates a fresh RSA key pair per call; nothing secret is stored anywhere. */
export async function createTestTokenIssuer(): Promise<TestTokenIssuer> {
  const { publicKey, privateKey } = await generateKeyPair(TEST_ALGORITHM);
  const publicJwk = { ...(await exportJWK(publicKey)), kid: TEST_KEY_ID, alg: TEST_ALGORITHM };
  const jwks: JSONWebKeySet = { keys: [publicJwk] };
  const localKeySet = createLocalJWKSet(jwks);

  const verifier: TokenVerifier = {
    async verify(token) {
      const { payload } = await jwtVerify(token, localKeySet, {
        algorithms: [TEST_ALGORITHM],
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
        currentDate: new Date(FIXED_NOW_SECONDS * 1000),
      });
      return principalFromPayload(payload);
    },
  };

  return {
    verifier,
    jwks,
    async issue(claims = {}) {
      const issuedAt = claims.issuedAt ?? FIXED_NOW_SECONDS;
      return new SignJWT({
        realm_access: { roles: claims.roles ?? ['customer'] },
        ...(claims.acr !== undefined && { acr: claims.acr }),
        ...(claims.authTime !== undefined && { auth_time: claims.authTime }),
      })
        .setProtectedHeader({ alg: TEST_ALGORITHM, kid: TEST_KEY_ID })
        .setSubject(claims.subject ?? 'test-subject-1')
        .setIssuer(claims.issuer ?? TEST_ISSUER)
        .setAudience(claims.audience ?? TEST_AUDIENCE)
        .setIssuedAt(issuedAt)
        .setExpirationTime(claims.expiresAt ?? issuedAt + ACCESS_TOKEN_LIFETIME_SECONDS)
        .sign(privateKey);
    },
  };
}
