import type * as OidcModule from './oidc';
import type * as SessionStoreModule from './session-store';
import { SECURE_STORAGE_KEYS } from './secure-storage.types';

// jest.setup.ts loads session-store.ts before this file registers its mocks, so a fresh copy is loaded here.
let createSessionStore: (typeof SessionStoreModule)['createSessionStore'];
let OidcAuthError: (typeof OidcModule)['OidcAuthError'];
beforeAll(() => {
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    createSessionStore = (require('./session-store') as typeof SessionStoreModule)
      .createSessionStore;
    OidcAuthError = (require('./oidc') as typeof OidcModule).OidcAuthError;
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
});

// One shared mock object: session-store imports './secure-storage' lazily at sign-out, possibly from another
// module registry, so the assertions must not depend on which registry created the mock.
const mockSecureStorage = {
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  deleteItem: jest.fn(() => Promise.resolve()),
};
jest.mock('./secure-storage', () => ({ secureStorage: mockSecureStorage }));

function toBase64Url(obj: Record<string, unknown>): string {
  return btoa(JSON.stringify(obj)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function makeJwt(payload: Record<string, unknown>): string {
  return `${toBase64Url({ alg: 'RS256', typ: 'JWT' })}.${toBase64Url(payload)}.sig`;
}

const accessToken = makeJwt({
  sub: 'kc-1',
  exp: 1_800_000_000,
  acr: '1',
  realm_access: { roles: ['customer'] },
});

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => jest.clearAllMocks());

describe('session store in live mode', () => {
  it('keeps every token in memory only: nothing is written to SecureStore on sign-in (SR-09, P-09)', async () => {
    const store = createSessionStore({ mockEnabled: false });

    store.setOidcSession({ accessToken, idToken: 'id-1', refreshToken: 'refresh-1' });
    await flush();

    expect(mockSecureStorage.setItem).not.toHaveBeenCalled();
    const state = store.getState();
    expect(state.status === 'signedIn' && state.refreshToken).toBe('refresh-1');
    expect(store.getAccessToken()).toBe(accessToken);
  });

  it('records the access token expiry for the refresh logic', () => {
    const store = createSessionStore({ mockEnabled: false });

    store.setOidcSession({ accessToken });

    const state = store.getState();
    expect(state.status === 'signedIn' && state.expiresAt).toBe(1_800_000_000_000);
  });

  it('drops the tokens and removes refresh token entries of older builds on sign-out', async () => {
    const store = createSessionStore({ mockEnabled: false });
    store.setOidcSession({ accessToken, refreshToken: 'refresh-1' });

    store.signOut();
    await flush();

    expect(store.getState()).toEqual({ status: 'signedOut' });
    expect(store.getAccessToken()).toBeNull();
    expect(mockSecureStorage.deleteItem).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.refreshToken);
    expect(mockSecureStorage.deleteItem).toHaveBeenCalledWith('sbank_refresh_token');
  });
});

describe('mock step-up', () => {
  it('sets acr=2 together with a fresh auth_time, so the fail-closed freshness check passes', () => {
    const store = createSessionStore({ mockEnabled: true, now: () => 1_700_000_123_456 });
    store.signInAsMock('customer');

    store.raiseMockAssurance();

    const state = store.getState();
    expect(state.status === 'signedIn' && state.principal).toMatchObject({
      acr: '2',
      authTime: 1_700_000_123,
    });
  });
});

describe('refresh (P-08)', () => {
  function signedInStore(
    refreshTokens: (token: string) => Promise<{ accessToken: string; refreshToken?: string }>,
  ) {
    const store = createSessionStore({ mockEnabled: false, refreshTokens });
    store.setOidcSession({ accessToken, refreshToken: 'refresh-1' });
    return store;
  }

  it('shares one refresh between concurrent callers and keeps the rotated refresh token', async () => {
    const newAccess = makeJwt({
      sub: 'kc-1',
      exp: 1_900_000_000,
      realm_access: { roles: ['customer'] },
    });
    const refreshTokens = jest.fn(() =>
      Promise.resolve({ accessToken: newAccess, refreshToken: 'refresh-2' }),
    );
    const store = signedInStore(refreshTokens);

    const results = await Promise.all([store.refresh(), store.refresh(), store.refresh()]);

    expect(results).toEqual([true, true, true]);
    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(refreshTokens).toHaveBeenCalledWith('refresh-1');
    const state = store.getState();
    expect(state.status === 'signedIn' && state.refreshToken).toBe('refresh-2');
    expect(store.getAccessToken()).toBe(newAccess);
  });

  it('signs out with session_expired when Keycloak refuses the refresh token', async () => {
    const store = signedInStore(() =>
      Promise.reject(new OidcAuthError('session_expired', 'invalid_grant')),
    );

    await expect(store.refresh()).resolves.toBe(false);

    expect(store.getState()).toEqual({ status: 'signedOut', reason: 'session_expired' });
  });

  it('keeps the session on a network error and lets the next request try again', async () => {
    const store = signedInStore(() => Promise.reject(new OidcAuthError('failed', 'offline')));

    await expect(store.refresh()).resolves.toBe(false);

    expect(store.getState().status).toBe('signedIn');
  });

  it('drops a refresh result that arrives after sign-out', async () => {
    let finish: (tokens: { accessToken: string }) => void = () => undefined;
    const store = signedInStore(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    const pending = store.refresh();
    store.signOut();
    finish({ accessToken });

    await expect(pending).resolves.toBe(false);
    expect(store.getState().status).toBe('signedOut');
  });

  it('cannot refresh without a refresh token', async () => {
    const refreshTokens = jest.fn();
    const store = createSessionStore({ mockEnabled: false, refreshTokens });
    store.setOidcSession({ accessToken });

    await expect(store.refresh()).resolves.toBe(false);
    expect(refreshTokens).not.toHaveBeenCalled();
  });
});
