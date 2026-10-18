// Vitest setup for e2e files: gives the app a hermetic configuration. Only DATABASE_URL is taken
// from the environment (CI service container or the developer's local database).
const TEST_ENVIRONMENT = {
  NODE_ENV: 'test',
  CORS_ORIGINS: 'http://localhost:8081',
  OIDC_ISSUER_URL: 'https://localhost/auth/realms/sbank',
  OIDC_AUDIENCE: 'sbank-api',
  OIDC_JWKS_URL: '',
  TRUST_PROXY: 'false',
};

Object.assign(process.env, TEST_ENVIRONMENT);
process.env['LOG_LEVEL'] ??= 'silent';

// Tests that never touch the database still need a syntactically valid URL for config validation.
process.env['DATABASE_URL'] ??= 'postgresql://unused:unused@127.0.0.1:1/unused';
