import type * as OidcModule from './oidc';

// jest.setup.ts already loads oidc.ts (through renderWithProviders) with the real Expo modules, so this file
// loads its own copy in an isolated registry where the mocks below apply.
let oidc: typeof OidcModule;
type AnyMock = jest.Mock<Promise<unknown>, unknown[]>;
let mocked: {
  fetchDiscoveryAsync: AnyMock;
  exchangeCodeAsync: AnyMock;
  AuthRequest: AnyMock;
  __promptAsync: AnyMock;
};
let openAuthSessionAsync: AnyMock;

jest.mock('expo-auth-session', () => {
  const promptAsync = jest.fn();
  return {
    CodeChallengeMethod: { S256: 'S256' },
    Prompt: { Login: 'login' },
    makeRedirectUri: jest.fn(() => 'sbank://oauth/callback'),
    fetchDiscoveryAsync: jest.fn(),
    exchangeCodeAsync: jest.fn(),
    AuthRequest: jest.fn().mockImplementation((config: unknown) => ({
      config,
      codeVerifier: 'test-verifier',
      promptAsync,
    })),
    __promptAsync: promptAsync,
  };
});
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-nonce' }));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(() => Promise.resolve({ type: 'dismiss' })),
}));

const ISSUER = 'http://localhost:8080/realms/sbank';

beforeAll(() => {
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    mocked = require('expo-auth-session') as typeof mocked;
    openAuthSessionAsync = (require('expo-web-browser') as { openAuthSessionAsync: AnyMock })
      .openAuthSessionAsync;
    oidc = require('./oidc') as typeof OidcModule;
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
});

function toBase64Url(obj: Record<string, unknown>): string {
  return btoa(JSON.stringify(obj)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function makeJwt(payload: Record<string, unknown>): string {
  return `${toBase64Url({ alg: 'RS256', typ: 'JWT' })}.${toBase64Url(payload)}.sig`;
}

function discoveryFor(issuer: string) {
  return {
    discoveryDocument: {
      issuer,
      authorization_endpoint: `${issuer}/protocol/openid-connect/auth`,
      token_endpoint: `${issuer}/protocol/openid-connect/token`,
      revocation_endpoint: `${issuer}/protocol/openid-connect/revoke`,
      end_session_endpoint: `${issuer}/protocol/openid-connect/logout`,
    },
  };
}

function requestConfig(): { extraParams: Record<string, string>; prompt?: string } & Record<
  string,
  unknown
> {
  return mocked.AuthRequest.mock.calls.at(-1)?.[0] as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  oidc.resetDiscoveryCache();
  mocked.fetchDiscoveryAsync.mockResolvedValue(discoveryFor(ISSUER));
  mocked.__promptAsync.mockResolvedValue({ type: 'success', params: { code: 'auth-code' } });
  mocked.exchangeCodeAsync.mockResolvedValue({
    accessToken: makeJwt({ sub: 'u1', realm_access: { roles: ['customer'] } }),
    idToken: makeJwt({ sub: 'u1', nonce: 'test-nonce' }),
    refreshToken: 'refresh-1',
  });
});

describe('authenticateWithOidc', () => {
  it('starts Authorization Code + PKCE S256 with nonce and acr_values, without offline_access', async () => {
    const tokens = await oidc.authenticateWithOidc({ acrValues: '1' });

    const config = requestConfig();
    expect(config).toMatchObject({
      clientId: 'sbank-app',
      redirectUri: 'sbank://oauth/callback',
      usePKCE: true,
      codeChallengeMethod: 'S256',
      scopes: ['openid', 'profile', 'email'],
      extraParams: { nonce: 'test-nonce', acr_values: '1' },
    });
    expect(config.prompt).toBeUndefined();
    expect(mocked.exchangeCodeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'auth-code',
        extraParams: { code_verifier: 'test-verifier' },
      }),
      expect.objectContaining({ tokenEndpoint: `${ISSUER}/protocol/openid-connect/token` }),
    );
    expect(tokens.refreshToken).toBe('refresh-1');
  });

  it('forces a fresh Passkey use for step-up (prompt=login, max_age=0)', async () => {
    await oidc.authenticateWithOidc({ acrValues: '2', forceReauthentication: true });

    const config = requestConfig();
    expect(config.prompt).toBe('login');
    expect(config.extraParams).toMatchObject({ acr_values: '2', max_age: '0' });
  });

  it('adds the sbank-passkey-login scope only for the Passkey path', async () => {
    await oidc.authenticateWithOidc({ acrValues: '2', passkeyLogin: true });
    expect(requestConfig().scopes).toEqual(['openid', 'profile', 'email', 'sbank-passkey-login']);

    await oidc.authenticateWithOidc({ acrValues: '1' });
    expect(requestConfig().scopes).toEqual(['openid', 'profile', 'email']);
  });

  it('refuses a discovery document of another issuer and never opens the browser', async () => {
    mocked.fetchDiscoveryAsync.mockResolvedValue(discoveryFor('http://evil.example/realms/sbank'));

    await expect(oidc.authenticateWithOidc()).rejects.toMatchObject({ code: 'failed' });
    expect(mocked.AuthRequest).not.toHaveBeenCalled();
  });

  it('reports an unreachable identity provider as a failed sign-in', async () => {
    mocked.fetchDiscoveryAsync.mockRejectedValue(new Error('network down'));

    await expect(oidc.authenticateWithOidc()).rejects.toBeInstanceOf(oidc.OidcAuthError);
  });

  it('rejects a callback whose state does not match (state_mismatch)', async () => {
    mocked.__promptAsync.mockResolvedValue({
      type: 'error',
      params: { error: 'state_mismatch' },
      error: { message: 'Cross-Site request verification failed' },
    });

    await expect(oidc.authenticateWithOidc()).rejects.toMatchObject({ code: 'failed' });
    expect(mocked.exchangeCodeAsync).not.toHaveBeenCalled();
  });

  it('rejects an ID token with a different nonce', async () => {
    mocked.exchangeCodeAsync.mockResolvedValue({
      accessToken: makeJwt({ sub: 'u1', realm_access: { roles: ['customer'] } }),
      idToken: makeJwt({ sub: 'u1', nonce: 'someone-else' }),
    });

    await expect(oidc.authenticateWithOidc()).rejects.toMatchObject({ code: 'failed' });
  });

  it('maps a cancelled browser window to cancelled and access_denied to access_denied', async () => {
    mocked.__promptAsync.mockResolvedValueOnce({ type: 'cancel' });
    await expect(oidc.authenticateWithOidc()).rejects.toMatchObject({ code: 'cancelled' });

    mocked.__promptAsync.mockResolvedValueOnce({
      type: 'error',
      params: { error: 'access_denied' },
    });
    await expect(oidc.authenticateWithOidc()).rejects.toMatchObject({ code: 'access_denied' });
  });
});

describe('signOutFromOidc', () => {
  it('ends the Keycloak session in the background with the refresh token', async () => {
    const fetchImpl = jest.fn(() => Promise.resolve(new Response(null, { status: 204 })));

    await oidc.signOutFromOidc({ refreshToken: 'refresh-1', idToken: 'id-1' }, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(`${ISSUER}/protocol/openid-connect/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'client_id=sbank-app&refresh_token=refresh-1',
    });
    expect(openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('falls back to the browser end_session redirect without a refresh token', async () => {
    const fetchImpl = jest.fn();

    await oidc.signOutFromOidc({ idToken: 'id-1' }, fetchImpl);

    expect(fetchImpl).not.toHaveBeenCalled();
    const url = openAuthSessionAsync.mock.calls[0]?.[0] as string;
    expect(url).toContain(`${ISSUER}/protocol/openid-connect/logout?`);
    expect(url).toContain('id_token_hint=id-1');
    expect(url).toContain('post_logout_redirect_uri=sbank%3A%2F%2Foauth%2Fcallback');
  });

  it('swallows network errors because the local session is already cleared', async () => {
    const fetchImpl = jest.fn(() => Promise.reject(new Error('offline')));

    await expect(oidc.signOutFromOidc({ refreshToken: 'r' }, fetchImpl)).resolves.toBeUndefined();
  });
});

describe('UI rules', () => {
  const base = { subject: 's', displayName: 'S' } as const;

  it('treats staff without acr=2 as needing the Passkey, customers never', () => {
    expect(oidc.requiresPasskeyForStaff({ ...base, roles: ['employee'], acr: '1' })).toBe(true);
    expect(oidc.requiresPasskeyForStaff({ ...base, roles: ['admin'], acr: '1' })).toBe(true);
    expect(oidc.requiresPasskeyForStaff({ ...base, roles: ['employee'], acr: '2' })).toBe(false);
    expect(oidc.requiresPasskeyForStaff({ ...base, roles: ['customer'], acr: '1' })).toBe(false);
  });

  it('does not treat acr=2 without auth_time as a fresh step-up (fail closed, like the API)', () => {
    expect(oidc.isStepUpFresh({ ...base, roles: ['customer'], acr: '2' }, 1000)).toBe(false);
  });
});
