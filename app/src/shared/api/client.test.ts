import { createApiClient } from './client';
import { ApiProblem } from './problem';

const BASE_URL = 'https://api.test';
const SUBJECT = 'subject-1';

function jsonResponse(status: number, body: unknown, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } });
}

describe('createApiClient', () => {
  it('sends the bearer token when a token is available', async () => {
    const seen: Request[] = [];
    const client = createApiClient({
      baseUrl: BASE_URL,
      getAccessToken: () => 'test-token',
      fetch: (request) => {
        seen.push(request);
        return Promise.resolve(
          jsonResponse(200, { subject: SUBJECT, roles: ['customer'], acr: '1' }),
        );
      },
    });

    const { data } = await client.GET('/api/me');

    expect(data?.subject).toBe(SUBJECT);
    expect(seen[0]?.headers.get('Authorization')).toBe('Bearer test-token');
  });

  it('sends no Authorization header when nobody is signed in', async () => {
    const seen: Request[] = [];
    const client = createApiClient({
      baseUrl: BASE_URL,
      getAccessToken: () => undefined,
      fetch: (request) => {
        seen.push(request);
        return Promise.resolve(jsonResponse(200, { subject: SUBJECT, roles: [], acr: null }));
      },
    });

    await client.GET('/api/me');

    expect(seen[0]?.headers.has('Authorization')).toBe(false);
  });

  it('turns an RFC 9457 error into an ApiProblem without keeping server text', async () => {
    const client = createApiClient({
      baseUrl: BASE_URL,
      getAccessToken: () => 'test-token',
      fetch: () =>
        Promise.resolve(
          jsonResponse(
            403,
            {
              type: 'step-up-required',
              title: 'Forbidden',
              status: 403,
              detail: 'internal detail',
            },
            'application/problem+json',
          ),
        ),
    });

    const failure = await client.GET('/api/me').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiProblem);
    expect(failure).toMatchObject({ status: 403 });
    expect(JSON.stringify(failure)).not.toContain('internal detail');
  });

  it('still reports the status when the error body is not JSON', async () => {
    const client = createApiClient({
      baseUrl: BASE_URL,
      getAccessToken: () => undefined,
      fetch: () => Promise.resolve(new Response('<html>bad gateway</html>', { status: 502 })),
    });

    const failure = await client.GET('/api/me').catch((error: unknown) => error);

    expect(failure).toMatchObject({ name: 'ApiProblem', status: 502 });
  });
});
