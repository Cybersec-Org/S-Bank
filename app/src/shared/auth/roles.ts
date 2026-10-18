export const ROLES = ['customer', 'employee', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/** Authentication context class reference: '1' password-level, '2' passkey step-up. */
export type AssuranceLevel = '1' | '2';

export interface Principal {
  readonly subject: string;
  readonly displayName: string;
  readonly roles: readonly Role[];
  readonly acr: AssuranceLevel;
}

/** UI convenience only; the API enforces roles from the verified token. */
export function hasRole(principal: Principal | null, role: Role): boolean {
  return principal !== null && principal.roles.includes(role);
}

export type HomeRoute = '/dashboard' | '/customers' | '/users';

/** Where a signed-in principal lands; highest privilege wins when a token carries several roles. */
export function homeRouteFor(principal: Principal): HomeRoute {
  if (hasRole(principal, 'admin')) {
    return '/users';
  }
  if (hasRole(principal, 'employee')) {
    return '/customers';
  }
  return '/dashboard';
}
