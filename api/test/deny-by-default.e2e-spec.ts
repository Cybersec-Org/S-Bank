import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers/create-test-app.js';
import { FIXED_NOW_SECONDS } from './helpers/factories.js';
import { TEST_CONTROLLERS } from './helpers/test-controllers.js';
import { TEST_AUDIENCE, TEST_ISSUER } from './helpers/test-tokens.js';
import { SignJWT } from 'jose';

const PROBLEM_JSON = /^application\/problem\+json/;

function bearer(token: string): string {
  return `Bearer ${token}`;
}

describe('deny by default (production placeholder verifier)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ verifier: 'fail-closed', controllers: TEST_CONTROLLERS });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('answers 401 problem details to a request without a token', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/api/me');

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.body).toMatchObject({
      type: '/problems/unauthorized',
      status: 401,
      traceId: response.headers['x-request-id'],
    });
  });

  it('answers 401 to every token, even a perfectly signed one, until real verification exists', async () => {
    const token = await testApp.tokens.issue({ roles: ['admin'] });

    const response = await request(testApp.app.getHttpServer())
      .get('/api/me')
      .set('Authorization', bearer(token));

    expect(response.status).toBe(401);
  });

  it.each(['garbage', 'a.b.c', 'null'])('answers 401 to the token %j', async (token) => {
    const response = await request(testApp.app.getHttpServer())
      .get('/api/me')
      .set('Authorization', bearer(token));

    expect(response.status).toBe(401);
  });

  it('still serves public routes anonymously', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/public/test');

    expect(response.status).toBe(200);
  });
});

describe('deny by default (test verifier)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ controllers: TEST_CONTROLLERS });
  });

  afterAll(async () => {
    await testApp.close();
  });

  const server = () => testApp.app.getHttpServer();

  describe('GET /api/me', () => {
    it.each(['customer', 'employee', 'admin'] as const)(
      'answers 200 for the %s role',
      async (role) => {
        const token = await testApp.tokens.issue({ subject: 'sub-1', roles: [role], acr: '1' });

        const response = await request(server()).get('/api/me').set('Authorization', bearer(token));

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ subject: 'sub-1', roles: [role], acr: '1' });
      },
    );

    it('answers 403 for the partner role', async () => {
      const token = await testApp.tokens.issue({ roles: ['partner'] });

      const response = await request(server()).get('/api/me').set('Authorization', bearer(token));

      expect(response.status).toBe(403);
      expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
      expect(response.body).toMatchObject({ type: '/problems/forbidden', status: 403 });
    });

    it('answers 403 for a valid token without any known role', async () => {
      const token = await testApp.tokens.issue({ roles: [] });

      const response = await request(server()).get('/api/me').set('Authorization', bearer(token));

      expect(response.status).toBe(403);
    });
  });

  describe('token negatives', () => {
    const forgeUnsigned = (payload: object): string => {
      const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
      return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
    };

    const claims = () => ({
      iss: TEST_ISSUER,
      aud: TEST_AUDIENCE,
      sub: 'attacker',
      iat: FIXED_NOW_SECONDS,
      exp: FIXED_NOW_SECONDS + 300,
      realm_access: { roles: ['admin'] },
    });

    it('rejects an expired token', async () => {
      const token = await testApp.tokens.issue({
        issuedAt: FIXED_NOW_SECONDS - 3600,
        expiresAt: FIXED_NOW_SECONDS - 1800,
      });

      const response = await request(server()).get('/api/me').set('Authorization', bearer(token));

      expect(response.status).toBe(401);
    });

    it('rejects a token issued for another audience', async () => {
      const token = await testApp.tokens.issue({ audience: 'another-api' });

      const response = await request(server()).get('/api/me').set('Authorization', bearer(token));

      expect(response.status).toBe(401);
    });

    it('rejects a token from another issuer', async () => {
      const token = await testApp.tokens.issue({ issuer: 'https://evil.example/realms/sbank' });

      const response = await request(server()).get('/api/me').set('Authorization', bearer(token));

      expect(response.status).toBe(401);
    });

    it('rejects an unsigned token with alg none', async () => {
      const response = await request(server())
        .get('/api/me')
        .set('Authorization', bearer(forgeUnsigned(claims())));

      expect(response.status).toBe(401);
    });

    it('rejects a token signed with HS256 using the public key as the secret', async () => {
      const secret = new TextEncoder().encode(JSON.stringify(testApp.tokens.jwks));
      const forged = await new SignJWT({ realm_access: { roles: ['admin'] } })
        .setProtectedHeader({ alg: 'HS256', kid: 'test-key-1' })
        .setSubject('attacker')
        .setIssuer(TEST_ISSUER)
        .setAudience(TEST_AUDIENCE)
        .setIssuedAt(FIXED_NOW_SECONDS)
        .setExpirationTime(FIXED_NOW_SECONDS + 300)
        .sign(secret);

      const response = await request(server()).get('/api/me').set('Authorization', bearer(forged));

      expect(response.status).toBe(401);
    });

    it('does not accept the token in a query string or cookie', async () => {
      const token = await testApp.tokens.issue();

      const response = await request(server())
        .get('/api/me')
        .query({ access_token: token })
        .set('Cookie', `access_token=${token}`);

      expect(response.status).toBe(401);
    });
  });

  describe('route declarations', () => {
    it('refuses a route that declares neither @Public() nor @Roles()', async () => {
      const token = await testApp.tokens.issue({ roles: ['admin'] });

      const response = await request(server())
        .get('/api/test/undeclared')
        .set('Authorization', bearer(token));

      expect(response.status).toBe(403);
    });

    it('refuses @Public() outside the public zone', async () => {
      const response = await request(server()).get('/api/test/misplaced-public');

      expect(response.status).toBe(403);
    });

    it('keeps the partner zone closed even for a valid partner token', async () => {
      const token = await testApp.tokens.issue({ roles: ['partner'] });

      const response = await request(server())
        .get('/partner/test')
        .set('Authorization', bearer(token));

      expect(response.status).toBe(403);
    });

    it('answers unknown routes with a 404 problem document', async () => {
      const response = await request(server()).get('/does-not-exist');

      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
      expect(response.body).toMatchObject({ type: '/problems/not-found', status: 404 });
    });

    it('answers unknown routes in the api zone with 404, not with information about auth', async () => {
      const token = await testApp.tokens.issue();

      const response = await request(server())
        .get('/api/unknown')
        .set('Authorization', bearer(token));

      expect(response.status).toBe(404);
    });
  });

  describe('step-up', () => {
    const stepUpRoute = '/api/test/step-up';

    it('answers 403 step-up-required to a password session and says what is needed', async () => {
      const token = await testApp.tokens.issue({
        roles: ['admin'],
        acr: '1',
        authTime: FIXED_NOW_SECONDS - 10,
      });

      const response = await request(server()).get(stepUpRoute).set('Authorization', bearer(token));

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        type: '/problems/step-up-required',
        requiredAcr: '2',
        maxAgeSeconds: 300,
      });
      expect(response.headers['www-authenticate']).toContain('insufficient_user_authentication');
    });

    it('answers 403 step-up-required when the token has no acr', async () => {
      const token = await testApp.tokens.issue({ roles: ['admin'] });

      const response = await request(server()).get(stepUpRoute).set('Authorization', bearer(token));

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ type: '/problems/step-up-required' });
    });

    it('answers 403 step-up-required when the passkey authentication is stale', async () => {
      const token = await testApp.tokens.issue({
        roles: ['admin'],
        acr: '2',
        authTime: FIXED_NOW_SECONDS - 3600,
      });

      const response = await request(server()).get(stepUpRoute).set('Authorization', bearer(token));

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ type: '/problems/step-up-required' });
    });

    it('answers 200 for a fresh passkey authentication', async () => {
      const token = await testApp.tokens.issue({
        roles: ['admin'],
        acr: '2',
        authTime: FIXED_NOW_SECONDS - 10,
      });

      const response = await request(server()).get(stepUpRoute).set('Authorization', bearer(token));

      expect(response.status).toBe(200);
    });

    it('answers a plain 403 to the wrong role, whatever the acr', async () => {
      const token = await testApp.tokens.issue({
        roles: ['customer'],
        acr: '2',
        authTime: FIXED_NOW_SECONDS - 10,
      });

      const response = await request(server()).get(stepUpRoute).set('Authorization', bearer(token));

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ type: '/problems/forbidden' });
    });
  });

  describe('input validation', () => {
    const post = async (body: unknown) => {
      const token = await testApp.tokens.issue({ roles: ['customer'] });
      return request(server())
        .post('/api/test/echo')
        .set('Authorization', bearer(token))
        .send(body as object);
    };

    it('accepts a valid body', async () => {
      const response = await post({ name: 'Anna', amountGrosze: 1250 });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ name: 'Anna', amountGrosze: 1250 });
    });

    it('rejects extra properties instead of dropping them', async () => {
      const response = await post({ name: 'Anna', amountGrosze: 1250, role: 'admin' });

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
      expect(response.body).toMatchObject({
        type: '/problems/validation-failed',
        errors: ['property role should not exist'],
      });
    });

    it.each([
      ['a string amount (no implicit conversion)', { name: 'Anna', amountGrosze: '1250' }],
      ['a fractional amount', { name: 'Anna', amountGrosze: 12.5 }],
      ['a zero amount', { name: 'Anna', amountGrosze: 0 }],
      ['a missing field', { name: 'Anna' }],
      ['an empty name', { name: '', amountGrosze: 100 }],
    ])('rejects %s', async (_label, body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ type: '/problems/validation-failed' });
    });

    it('rejects malformed JSON without leaking parser internals', async () => {
      const token = await testApp.tokens.issue({ roles: ['customer'] });

      const response = await request(server())
        .post('/api/test/echo')
        .set('Authorization', bearer(token))
        .set('Content-Type', 'application/json')
        .send('{"name": ');

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
      expect(JSON.stringify(response.body)).not.toMatch(/SyntaxError|Unexpected|at /);
    });

    it('rejects bodies over 100 kB with 413', async () => {
      const token = await testApp.tokens.issue({ roles: ['customer'] });

      const response = await request(server())
        .post('/api/test/echo')
        .set('Authorization', bearer(token))
        .send({ name: 'x'.repeat(150_000), amountGrosze: 1 });

      expect(response.status).toBe(413);
      expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
    });
  });

  describe('error responses', () => {
    it('hides the message and stack of unexpected errors', async () => {
      const token = await testApp.tokens.issue({ roles: ['customer'] });

      const response = await request(server())
        .get('/api/test/explode')
        .set('Authorization', bearer(token));

      expect(response.status).toBe(500);
      expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
      expect(JSON.stringify(response.body)).not.toMatch(/hunter2|postgresql|sbank_app|\.ts|at /);
      expect(response.body).toMatchObject({ type: '/problems/internal-error' });
    });

    it('uses a well formed caller request id as the traceId and replaces a malformed one', async () => {
      const kept = await request(server()).get('/api/me').set('X-Request-Id', 'caller-trace-0001');
      const replaced = await request(server())
        .get('/api/me')
        .set('X-Request-Id', 'bad id with spaces');

      expect((kept.body as { traceId: string }).traceId).toBe('caller-trace-0001');
      expect(kept.headers['x-request-id']).toBe('caller-trace-0001');
      expect((replaced.body as { traceId: string }).traceId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('transport hardening', () => {
    it('sends an API content security policy and hides the framework', async () => {
      const response = await request(server()).get('/api/me');

      expect(response.headers['content-security-policy']).toContain("default-src 'none'");
      expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('allows cross-origin calls only from the configured origin', async () => {
      const allowed = await request(server())
        .get('/public/test')
        .set('Origin', 'http://localhost:8081');
      const denied = await request(server())
        .get('/public/test')
        .set('Origin', 'https://evil.example');

      expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:8081');
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
      expect(allowed.headers['access-control-allow-credentials']).toBeUndefined();
    });
  });
});

describe('rate limiting', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ controllers: TEST_CONTROLLERS });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('rate limits the public zone and answers 429 problem details', async () => {
    const responses = [];
    for (let attempt = 0; attempt < 31; attempt += 1) {
      responses.push(await request(testApp.app.getHttpServer()).get('/public/test'));
    }

    const limited = responses.at(-1);
    expect(responses.slice(0, 30).every((response) => response.status === 200)).toBe(true);
    expect(limited?.status).toBe(429);
    expect(limited?.headers['content-type']).toMatch(PROBLEM_JSON);
    expect(Number(limited?.headers['retry-after'])).toBeGreaterThan(0);
  });
});
