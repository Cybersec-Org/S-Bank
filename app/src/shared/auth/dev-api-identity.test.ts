import { DEV_API_PRINCIPALS, devApiIdentityFor } from './dev-api-identity';
import { createSessionStore } from './session-store';

describe('dev API identity', () => {
  it('maps each demo role to the API mock guard role and seeded user id', () => {
    expect(devApiIdentityFor(DEV_API_PRINCIPALS.customer)).toEqual({
      userId: 'client-1',
      role: 'CLIENT',
    });
    expect(devApiIdentityFor(DEV_API_PRINCIPALS.employee)).toEqual({
      userId: 'emp-1',
      role: 'EMPLOYEE',
    });
    expect(devApiIdentityFor(DEV_API_PRINCIPALS.admin).role).toBe('ADMIN');
  });

  it('uses the highest role when a principal has several', () => {
    const both = { ...DEV_API_PRINCIPALS.customer, roles: ['customer', 'employee'] as const };

    expect(devApiIdentityFor(both).role).toBe('EMPLOYEE');
  });

  it('lets the session store sign in as the seeded API users', () => {
    const store = createSessionStore({ mockEnabled: true, principals: DEV_API_PRINCIPALS });

    store.signInAsMock('customer');

    const state = store.getState();
    expect(state.status === 'signedIn' && state.principal.subject).toBe('client-1');
  });
});
