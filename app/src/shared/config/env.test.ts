import { parseEnv } from './env';

describe('parseEnv', () => {
  it('defaults to mock mode outside production builds', () => {
    expect(parseEnv({}, false).apiMode).toBe('mock');
  });

  it('defaults to live mode in production builds, so mock data cannot appear by accident', () => {
    expect(parseEnv({}, true).apiMode).toBe('live');
  });

  it('treats an empty value like an unset one', () => {
    expect(parseEnv({ EXPO_PUBLIC_API_MODE: '  ' }, true).apiMode).toBe('live');
  });

  it('defaults to the docker-compose.yml addresses in development (API on localhost:3000, Keycloak issuer)', () => {
    const env = parseEnv({}, false);
    expect(env.apiBaseUrl).toBe('http://localhost:3000');
    expect(env.oidcIssuerUrl).toBe('http://localhost:8080/realms/sbank');
    expect(env.oidcClientId).toBe('sbank-app');
  });

  it('keeps https placeholders in production, so the https rule still holds without explicit URLs', () => {
    const env = parseEnv({}, true);
    expect(env.apiBaseUrl.startsWith('https://')).toBe(true);
    expect(env.oidcIssuerUrl.startsWith('https://')).toBe(true);
  });

  it('honours an explicit mode', () => {
    expect(parseEnv({ EXPO_PUBLIC_API_MODE: 'mock' }, true).apiMode).toBe('mock');
    expect(parseEnv({ EXPO_PUBLIC_API_MODE: 'live' }, false).apiMode).toBe('live');
  });

  it('accepts hybrid mode in development builds', () => {
    expect(parseEnv({ EXPO_PUBLIC_API_MODE: 'hybrid' }, false).apiMode).toBe('hybrid');
  });

  it('refuses hybrid mode in production builds, because it sends spoofable identity headers', () => {
    expect(() =>
      parseEnv(
        { EXPO_PUBLIC_API_MODE: 'hybrid', EXPO_PUBLIC_API_BASE_URL: 'https://api.example.test' },
        true,
      ),
    ).toThrow(/apiMode/);
  });

  it('rejects an unknown mode and names the variable without echoing values', () => {
    expect(() => parseEnv({ EXPO_PUBLIC_API_MODE: 'demo' }, false)).toThrow(/apiMode/);
    expect(() => parseEnv({ EXPO_PUBLIC_API_MODE: 'demo' }, false)).not.toThrow(/demo/);
  });

  it('rejects non-https URLs in production builds', () => {
    expect(() => parseEnv({ EXPO_PUBLIC_API_BASE_URL: 'http://api.example.test' }, true)).toThrow(
      /apiBaseUrl/,
    );
    expect(() =>
      parseEnv({ EXPO_PUBLIC_OIDC_ISSUER_URL: 'http://idp.example.test' }, true),
    ).toThrow(/oidcIssuerUrl/);
  });

  it('allows http URLs for local development', () => {
    const env = parseEnv({ EXPO_PUBLIC_API_BASE_URL: 'http://localhost:3000' }, false);
    expect(env.apiBaseUrl).toBe('http://localhost:3000');
  });

  it('rejects values that are not URLs', () => {
    expect(() => parseEnv({ EXPO_PUBLIC_API_BASE_URL: 'not a url' }, false)).toThrow(/apiBaseUrl/);
  });
});
