import { z } from 'zod';

import { createFakeDevApi, FAKE_DEV_API_URL } from '@/shared/testing/fake-dev-api';

import { createDevApiTransport } from './dev-api-transport';
import { ApiProblem, HTTP_BAD_GATEWAY, HTTP_NO_RESPONSE } from './problem';

const okSchema = z.object({ ok: z.boolean() });

describe('createDevApiTransport', () => {
  it('sends the demo identity headers and a JSON body', async () => {
    const { transport, requests } = createFakeDevApi({ 'POST /things': { body: { ok: true } } });

    await expect(
      transport.request({ method: 'POST', path: '/things', schema: okSchema, body: { a: 1 } }),
    ).resolves.toEqual({ ok: true });

    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: `${FAKE_DEV_API_URL}/things`,
      body: { a: 1 },
      headers: {
        'x-user-id': 'client-1',
        'x-user-role': 'CLIENT',
        'Content-Type': 'application/json',
      },
    });
  });

  it('sends no identity headers when nobody is signed in', async () => {
    const { transport, requests } = createFakeDevApi({ 'GET /x': { body: { ok: true } } }, null);

    await transport.request({ method: 'GET', path: '/x', schema: okSchema });

    expect(requests[0]?.headers).not.toHaveProperty('x-user-id');
    expect(requests[0]?.headers).not.toHaveProperty('x-user-role');
  });

  it('builds the query string and skips empty values', async () => {
    const { transport, requests } = createFakeDevApi({ 'GET /search': { body: { ok: true } } });

    await transport.request({
      method: 'GET',
      path: '/search',
      schema: okSchema,
      query: { query: 'jan k', empty: '', missing: undefined },
    });

    expect(requests[0]?.url).toBe(`${FAKE_DEV_API_URL}/search?query=jan+k`);
  });

  it('turns an API error code into a typed problem without the server message', async () => {
    const { transport } = createFakeDevApi({
      'POST /transfers': {
        status: 422,
        body: { code: 'DAILY_LIMIT_EXCEEDED', message: 'Used today: 250, Limit: 2000' },
      },
    });

    const error: unknown = await transport
      .request({ method: 'POST', path: '/transfers', schema: okSchema })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiProblem);
    expect(error).toMatchObject({ status: 422, code: 'daily_limit_exceeded' });
    expect(String(error)).not.toContain('250');
  });

  it('treats a response of the wrong shape as a server error', async () => {
    const { transport } = createFakeDevApi({ 'GET /x': { body: { unexpected: 1 } } });

    await expect(
      transport.request({ method: 'GET', path: '/x', schema: okSchema }),
    ).rejects.toMatchObject({ status: HTTP_BAD_GATEWAY });
  });

  it('reports a failed connection as a problem with no HTTP status', async () => {
    const transport = createDevApiTransport({
      baseUrl: FAKE_DEV_API_URL,
      getIdentity: () => null,
      fetch: () => Promise.reject(new TypeError('Network request failed')),
    });

    await expect(
      transport.request({ method: 'GET', path: '/x', schema: okSchema }),
    ).rejects.toMatchObject({ status: HTTP_NO_RESPONSE });
  });
});
