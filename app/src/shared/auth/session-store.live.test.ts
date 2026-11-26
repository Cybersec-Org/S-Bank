import type * as SessionStoreModule from './session-store';
import { SECURE_STORAGE_KEYS } from './secure-storage.types';

// jest.setup.ts loads session-store.ts before this file registers its mocks, so a fresh copy is loaded here.
let createSessionStore: (typeof SessionStoreModule)['createSessionStore'];
beforeAll(() => {
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    createSessionStore = (require('./session-store') as typeof SessionStoreModule)
      .createSessionStore;
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
