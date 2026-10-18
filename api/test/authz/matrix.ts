import type { Role } from '../../src/security/auth/principal.js';

/** Who calls: a role, or `guest` for no token at all. */
export type Caller = Role | 'guest';

export interface AuthzCase {
  /** README roles table, column "Czego NIE może" (or "Co może" for allowed rows), abridged. */
  readonly rule: string;
  readonly caller: Caller;
  readonly method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  readonly path: string;
  readonly expectedStatus: number;
}

/**
 * Role x endpoint -> expected status. Rows are added per feature by the `authz-tests` skill;
 * every row in the README column "Czego NIE może" must end up here as a refused case.
 */
export const AUTHZ_MATRIX: readonly AuthzCase[] = [
  {
    rule: 'Gość: wywołać żadnego innego endpointu – API domyślnie odmawia',
    caller: 'guest',
    method: 'get',
    path: '/api/me',
    expectedStatus: 401,
  },
  {
    rule: 'Klient: widzieć własną tożsamość',
    caller: 'customer',
    method: 'get',
    path: '/api/me',
    expectedStatus: 200,
  },
  {
    rule: 'Pracownik: zalogowany pracownik widzi własną tożsamość',
    caller: 'employee',
    method: 'get',
    path: '/api/me',
    expectedStatus: 200,
  },
  {
    rule: 'Administrator: zalogowany administrator widzi własną tożsamość',
    caller: 'admin',
    method: 'get',
    path: '/api/me',
    expectedStatus: 200,
  },
  {
    rule: 'Partner API: wywołać endpointów użytkowników (/api) – tylko /partner z mTLS',
    caller: 'partner',
    method: 'get',
    path: '/api/me',
    expectedStatus: 403,
  },
];
