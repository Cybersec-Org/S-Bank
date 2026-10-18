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

  it('honours an explicit mode', () => {
    expect(parseEnv({ EXPO_PUBLIC_API_MODE: 'mock' }, true).apiMode).toBe('mock');
    expect(parseEnv({ EXPO_PUBLIC_API_MODE: 'live' }, false).apiMode).toBe('live');
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
