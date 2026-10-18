import type { Principal } from './principal.js';

/** Injection token for the active {@link TokenVerifier}. */
export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

export interface TokenVerifier {
  /** Resolves to the caller or rejects (any rejection means 401). */
  verify(token: string): Promise<Principal>;
}
