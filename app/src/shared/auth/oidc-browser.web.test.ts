import type * as AuthSession from 'expo-auth-session';

import { isSafeReturnPath, startAuthorization, takePendingAuthorization } from './oidc-browser.web';

const memory = new Map<string, string>();
const fakeSessionStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
};

beforeAll(() => {
  Object.defineProperty(globalThis, 'window', {
    value: { sessionStorage: fakeSessionStorage },
    configurable: true,
  });
});
beforeEach(() => memory.clear());

function fakeRequest(): AuthSession.AuthRequest {
  return {
    state: 'state-1',
    codeVerifier: 'v'.repeat(64),
    makeAuthUrlAsync: () => Promise.resolve('http://localhost:8080/realms/sbank/auth?x=1'),
  } as unknown as AuthSession.AuthRequest;
}

const discovery = {} as AuthSession.DiscoveryDocument;
const pending = { nonce: 'nonce-1', redirectUri: 'http://localhost:8081/oauth/callback' };

describe('web sign-in in the same tab (P-17)', () => {
  it('stores the one-time sign-in data (never tokens) and navigates the tab to Keycloak', async () => {
    const navigate = jest.fn();

    const outcome = await startAuthorization(
      fakeRequest(),
      discovery,
      { ...pending, returnTo: '/transfer/abc' },
      navigate,
      () => 1000,
    );

    expect(outcome).toEqual({ kind: 'redirected' });
    expect(navigate).toHaveBeenCalledWith('http://localhost:8080/realms/sbank/auth?x=1');
    const stored = JSON.parse(memory.get('sbank.oidc.pending') ?? '{}') as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual(
      ['codeVerifier', 'createdAt', 'nonce', 'redirectUri', 'returnTo', 'state'].sort(),
    );
  });

  it('gives the pending sign-in back only for the matching state, and only once', async () => {
    await startAuthorization(fakeRequest(), discovery, pending, jest.fn(), () => 1000);

    expect(takePendingAuthorization('state-1', () => 2000)).toMatchObject({
      state: 'state-1',
      nonce: 'nonce-1',
    });
    expect(takePendingAuthorization('state-1', () => 2000)).toBeNull();
  });

  it('drops the entry on a foreign state (CSRF) instead of keeping it for a retry', async () => {
    await startAuthorization(fakeRequest(), discovery, pending, jest.fn(), () => 1000);

    expect(takePendingAuthorization('attacker-state', () => 2000)).toBeNull();
    expect(memory.has('sbank.oidc.pending')).toBe(false);
  });

  it('refuses an entry older than 10 minutes', async () => {
    await startAuthorization(fakeRequest(), discovery, pending, jest.fn(), () => 0);

    expect(takePendingAuthorization('state-1', () => 10 * 60 * 1000 + 1)).toBeNull();
  });

  it('accepts only in-app return paths (no open redirect)', () => {
    expect(isSafeReturnPath('/transfer/abc?x=1')).toBe(true);
    expect(isSafeReturnPath('//evil.example/x')).toBe(false);
    expect(isSafeReturnPath('https://evil.example')).toBe(false);
    expect(isSafeReturnPath('/\\evil.example')).toBe(false);
    expect(isSafeReturnPath(undefined)).toBe(false);
  });
});
