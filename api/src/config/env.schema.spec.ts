import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from './env.schema.js';

const validEnvironment = {
  DATABASE_URL: 'postgresql://sbank_app:placeholder@localhost:5432/sbank',
  OIDC_ISSUER_URL: 'https://localhost/auth/realms/sbank',
  OIDC_AUDIENCE: 'sbank-api',
};

function invalidVariablesFor(environment: Record<string, unknown>): readonly string[] {
  try {
    parseEnv(environment);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return error.invalidVariables;
    }
    throw error;
  }
  return [];
}

describe('parseEnv', () => {
  it('applies the documented defaults when optional variables are unset', () => {
    const env = parseEnv(validEnvironment);

    expect(env).toMatchObject({
      NODE_ENV: 'production',
      API_PORT: 3000,
      CORS_ORIGINS: [],
      LOG_LEVEL: 'info',
      STEP_UP_THRESHOLD_GROSZE: 100_000,
      DEFAULT_DAILY_LIMIT_GROSZE: 500_000,
      NBP_API_BASE_URL: 'https://api.nbp.pl/api',
      TRUST_PROXY: false,
    });
    expect(env.OIDC_JWKS_URL).toBeUndefined();
  });

  it('treats empty strings like unset variables', () => {
    const env = parseEnv({
      ...validEnvironment,
      OIDC_JWKS_URL: '',
      CORS_ORIGINS: '',
      API_PORT: '',
    });

    expect(env.OIDC_JWKS_URL).toBeUndefined();
    expect(env.CORS_ORIGINS).toEqual([]);
    expect(env.API_PORT).toBe(3000);
  });

  it('parses a comma separated CORS allowlist', () => {
    const env = parseEnv({
      ...validEnvironment,
      CORS_ORIGINS: 'http://localhost:8081, https://localhost',
    });

    expect(env.CORS_ORIGINS).toEqual(['http://localhost:8081', 'https://localhost']);
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('parses TRUST_PROXY=%s', (value, expected) => {
    expect(parseEnv({ ...validEnvironment, TRUST_PROXY: value }).TRUST_PROXY).toBe(expected);
  });

  it.each(['yes', '1', 'TRUE', 'tru', ' true'])('rejects TRUST_PROXY=%j', (value) => {
    expect(invalidVariablesFor({ ...validEnvironment, TRUST_PROXY: value })).toEqual([
      'TRUST_PROXY [invalid_value]',
    ]);
  });

  it.each([
    ['DATABASE_URL', 'mysql://user@localhost/db'],
    ['OIDC_ISSUER_URL', 'not a url'],
    ['OIDC_ISSUER_URL', 'ftp://localhost/realm'],
    ['OIDC_AUDIENCE', ''],
    ['API_PORT', 'abc'],
    ['API_PORT', '70000'],
    ['CORS_ORIGINS', 'http://localhost:8081/'],
    ['CORS_ORIGINS', 'localhost:8081'],
    ['LOG_LEVEL', 'verbose'],
    ['NODE_ENV', 'staging'],
    ['STEP_UP_THRESHOLD_GROSZE', '-1'],
    ['STEP_UP_THRESHOLD_GROSZE', '1.5'],
    ['STEP_UP_THRESHOLD_GROSZE', '100001'],
    ['DEFAULT_DAILY_LIMIT_GROSZE', '5000001'],
    ['NBP_API_BASE_URL', 'javascript:alert(1)'],
  ])('rejects %s=%j', (variable, value) => {
    const invalidVariables = invalidVariablesFor({ ...validEnvironment, [variable]: value });

    expect(invalidVariables.map((entry) => entry.split(' ')[0])).toContain(variable);
  });

  it('reports every missing required variable', () => {
    const invalidVariables = invalidVariablesFor({});

    expect(invalidVariables.map((entry) => entry.split(' ')[0])).toEqual([
      'DATABASE_URL',
      'OIDC_ISSUER_URL',
      'OIDC_AUDIENCE',
    ]);
  });

  it('names invalid variables in the error without echoing their values', () => {
    const secretValue = 'mysql://admin:hunter2-not-a-real-secret@db.internal/bank';

    const failure = () => parseEnv({ ...validEnvironment, DATABASE_URL: secretValue });

    expect(failure).toThrow(/DATABASE_URL/);
    expect(failure).not.toThrow(/hunter2|admin|db\.internal/);
  });
});
