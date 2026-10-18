import type { Principal } from '../../src/security/auth/principal.js';

/** Fixed "now" (2026-01-01T12:00:00Z) so expiry-sensitive tests are deterministic. */
export const FIXED_NOW_SECONDS = 1_767_268_800;

export const fixedClock = { nowSeconds: () => FIXED_NOW_SECONDS };

export function buildPrincipal(overrides: Partial<Principal> = {}): Principal {
  return {
    subject: 'subject-customer-1',
    roles: ['customer'],
    acr: '1',
    authTime: FIXED_NOW_SECONDS - 60,
    ...overrides,
  };
}
