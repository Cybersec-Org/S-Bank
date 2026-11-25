import type { Principal, Role } from './roles';

/** Role names of the dev API's mock guard (`api/src/auth/mock-auth.guard.ts`). */
export type DevApiRole = 'CLIENT' | 'EMPLOYEE' | 'ADMIN';

export interface DevApiIdentity {
  readonly userId: string;
  readonly role: DevApiRole;
}

const DEV_API_ROLES: Readonly<Record<Role, DevApiRole>> = {
  customer: 'CLIENT',
  employee: 'EMPLOYEE',
  admin: 'ADMIN',
};

/**
 * Hybrid-mode demo identities. Subjects are the ids the dev API seeds (`api/prisma/seed.ts`), so the API
 * returns that person's accounts. The dev API trusts these headers blindly, which is why hybrid mode is
 * refused in production builds.
 */
export const DEV_API_PRINCIPALS: Readonly<Record<Role, Principal>> = {
  customer: {
    subject: 'client-1',
    displayName: 'Jan Kowalski',
    roles: ['customer'],
    acr: '1',
  },
  employee: {
    subject: 'emp-1',
    displayName: 'Pracownik demonstracyjny',
    roles: ['employee'],
    acr: '2',
  },
  admin: {
    subject: 'admin-1',
    displayName: 'Administrator demonstracyjny',
    roles: ['admin'],
    acr: '2',
  },
};

const ROLE_PRIORITY: readonly Role[] = ['admin', 'employee', 'customer'];

/** Headers identity for a signed-in principal; the highest role wins. */
export function devApiIdentityFor(principal: Principal): DevApiIdentity {
  const role = ROLE_PRIORITY.find((candidate) => principal.roles.includes(candidate)) ?? 'customer';
  return { userId: principal.subject, role: DEV_API_ROLES[role] };
}
