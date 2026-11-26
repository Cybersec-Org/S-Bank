import type * as OidcModule from './oidc';
import type * as WebBrowserModule from './oidc-browser.web';

type AnyMock = jest.Mock<Promise<unknown>, unknown[]>;

jest.mock('expo-auth-session', () => ({
  CodeChallengeMethod: { S256: 'S256' },
  Prompt: { Login: 'login' },
  makeRedirectUri: jest.fn(() => 'http://localhost:8081/oauth/callback'),
  fetchDiscoveryAsync: jest.fn(),
  exchangeCodeAsync: jest.fn(),
  AuthRequest: jest.fn(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'nonce-1' }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
// The redirect completion is the web path: use the web variant of the browser module in this test.
jest.mock('./oidc-browser', () =>
  jest.requireActual<typeof WebBrowserModule>('./oidc-browser.web'),
);

const ISSUER = 'http://localhost:8080/realms/sbank';
const memory = new Map<string, string>();
let oidc: typeof OidcModule;
let mocked: { fetchDiscoveryAsync: AnyMock; exchangeCodeAsync: AnyMock };

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `${b64({ alg: 'RS256' })}.${b64(payload)}.sig`;
}

function storePending(state: string, extra: Record<string, unknown> = {}): void {
  memory.set(
    'sbank.oidc.pending',
    JSON.stringify({
      state,
      codeVerifier: 'v'.repeat(64),
      nonce: 'nonce-1',
      redirectUri: 'http://localhost:8081/oauth/callback',
      createdAt: Date.now(),
      ...extra,
    }),
  );
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'window', {
    value: {
      sessionStorage: {
        getItem: (k: string) => memory.get(k) ?? null,
        setItem: (k: string, v: string) => memory.set(k, v),
        removeItem: (k: string) => memory.delete(k),
      },
    },
    configurable: true,
  });
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    mocked = require('expo-auth-session') as typeof mocked;
    oidc = require('./oidc') as typeof OidcModule;
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  memory.clear();
  oidc.resetDiscoveryCache();
  mocked.fetchDiscoveryAsync.mockResolvedValue({
    discoveryDocument: {
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
      token_endpoint: `${ISSUER}/protocol/openid-connect/token`,
    },
  });
  mocked.exchangeCodeAsync.mockResolvedValue({
    accessToken: jwt({ sub: 'u1', realm_access: { roles: ['customer'] } }),
    idToken: jwt({ sub: 'u1', nonce: 'nonce-1' }),
  });
});

describe('completeOidcRedirect (web)', () => {
  it('exchanges the code with the stored verifier and returns the return path', async () => {
    storePending('s1', { returnTo: '/transfer/abc' });

    const done = await oidc.completeOidcRedirect(
      'http://localhost:8081/oauth/callback?code=c1&state=s1',
    );

    expect(done.returnTo).toBe('/transfer/abc');
    expect(mocked.exchangeCodeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'c1', extraParams: { code_verifier: 'v'.repeat(64) } }),
      expect.anything(),
    );
  });

  it('refuses a callback whose state was not issued by this tab', async () => {
    storePending('s1');

    await expect(
      oidc.completeOidcRedirect('http://localhost:8081/oauth/callback?code=c1&state=forged'),
    ).rejects.toMatchObject({ code: 'failed' });
    expect(mocked.exchangeCodeAsync).not.toHaveBeenCalled();
  });

  it('refuses a replayed callback URL', async () => {
    storePending('s1');
    const url = 'http://localhost:8081/oauth/callback?code=c1&state=s1';
    await oidc.completeOidcRedirect(url);

    await expect(oidc.completeOidcRedirect(url)).rejects.toMatchObject({ code: 'failed' });
  });

  it('maps an access_denied redirect (e.g. Deny access for staff) to access_denied', async () => {
    storePending('s1');

    await expect(
      oidc.completeOidcRedirect(
        'http://localhost:8081/oauth/callback?error=access_denied&state=s1',
      ),
    ).rejects.toMatchObject({ code: 'access_denied' });
  });

  it('rejects an ID token with another nonce', async () => {
    storePending('s1');
    mocked.exchangeCodeAsync.mockResolvedValue({
      accessToken: jwt({ sub: 'u1', realm_access: { roles: ['customer'] } }),
      idToken: jwt({ sub: 'u1', nonce: 'other' }),
    });

    await expect(
      oidc.completeOidcRedirect('http://localhost:8081/oauth/callback?code=c1&state=s1'),
    ).rejects.toMatchObject({ code: 'failed' });
  });
});
