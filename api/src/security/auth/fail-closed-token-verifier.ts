import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Principal } from './principal.js';
import type { TokenVerifier } from './token-verifier.js';

/**
 * Placeholder until real verification exists: every token is rejected, so no route can be
 * reached by accident.
 */
// B-11: replace with JoseTokenVerifier (JWKS, algorithms: ['RS256','PS256','ES256'], issuer, audience, clockTolerance <= 5s)
@Injectable()
export class FailClosedTokenVerifier implements TokenVerifier {
  verify(): Promise<Principal> {
    return Promise.reject(new UnauthorizedException());
  }
}
