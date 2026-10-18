import type { Principal, Role } from './roles';

/** Clearly fictional demo identities; staff accounts already carry the passkey assurance level. */
export const MOCK_PRINCIPALS: Readonly<Record<Role, Principal>> = {
  customer: {
    subject: '00000000-0000-4000-8000-0000000000c1',
    displayName: 'Anna Testowa',
    roles: ['customer'],
    acr: '1',
  },
  employee: {
    subject: '00000000-0000-4000-8000-0000000000e1',
    displayName: 'Jan Przykładowy',
    roles: ['employee'],
    acr: '2',
  },
  admin: {
    subject: '00000000-0000-4000-8000-0000000000a1',
    displayName: 'Adam Demonstracyjny',
    roles: ['admin'],
    acr: '2',
  },
};
