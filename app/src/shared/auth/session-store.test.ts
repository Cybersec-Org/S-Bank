import { hasRole, homeRouteFor } from './roles';
import { createSessionStore } from './session-store';

describe('session store', () => {
  it('starts signed out without any principal', () => {
    const store = createSessionStore({ mockEnabled: true });

    expect(store.getState()).toEqual({ status: 'signedOut' });
  });

  it('signs in as a demo identity with the matching role', () => {
    const store = createSessionStore({ mockEnabled: true });

    store.signInAsMock('employee');

    const state = store.getState();
    expect(state.status).toBe('signedIn');
    expect(state.status === 'signedIn' && hasRole(state.principal, 'employee')).toBe(true);
  });

  it('refuses mock sign-in when mock mode is off', () => {
    const store = createSessionStore({ mockEnabled: false });

    expect(() => store.signInAsMock('admin')).toThrow();
    expect(store.getState().status).toBe('signedOut');
  });

  it('raises the assurance level only through the mock step-up', () => {
    const store = createSessionStore({ mockEnabled: true });
    store.signInAsMock('customer');

    store.raiseMockAssurance();

    const state = store.getState();
    expect(state.status === 'signedIn' && state.principal.acr).toBe('2');
  });

  it('refuses the mock step-up when mock mode is off', () => {
    const store = createSessionStore({ mockEnabled: false });

    expect(() => store.raiseMockAssurance()).toThrow();
  });

  it('notifies subscribers on change and stops after unsubscribe', () => {
    const store = createSessionStore({ mockEnabled: true });
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);

    store.signInAsMock('customer');
    unsubscribe();
    store.signOut();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('signs out', () => {
    const store = createSessionStore({ mockEnabled: true });
    store.signInAsMock('customer');

    store.signOut();

    expect(store.getState().status).toBe('signedOut');
  });
});

describe('roles', () => {
  it('sends each role to its own home route, highest privilege first', () => {
    const store = createSessionStore({ mockEnabled: true });
    const routes = (['customer', 'employee', 'admin'] as const).map((role) => {
      store.signInAsMock(role);
      const state = store.getState();
      return state.status === 'signedIn' ? homeRouteFor(state.principal) : null;
    });

    expect(routes).toEqual(['/dashboard', '/customers', '/users']);
  });

  it('denies every role to a missing principal', () => {
    expect(hasRole(null, 'customer')).toBe(false);
  });
});
