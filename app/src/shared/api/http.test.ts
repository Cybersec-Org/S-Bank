import { z } from 'zod';

import { createHttpTransport, REQUEST_TIMEOUT_MS } from './http';
import { ApiProblem } from './problem';

const okBody = { ok: true };
const schema = z.object({ ok: z.boolean() });

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('HTTP transport (live repositories)', () => {
  it('sends the in-memory access token as Bearer', async () => {
    const fetchImpl = jest.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(json(200, okBody)),
    );
    const transport = createHttpTransport({
      getAccessToken: () => 'access-1',
      baseUrl: 'http://api.test',
      fetch: fetchImpl as unknown as typeof fetch,
    });

    await expect(transport.requestJson('/accounts', schema)).resolves.toEqual(okBody);

    const init = fetchImpl.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
  });

  it('on a 401 refreshes once and retries with the new token', async () => {
    let token = 'expired';
    const fetchImpl = jest
      .fn<Promise<Response>, [string, RequestInit?]>()
      .mockResolvedValueOnce(json(401, { statusCode: 401 }))
      .mockResolvedValueOnce(json(200, okBody));
    const refreshSession = jest.fn(() => {
      token = 'fresh';
      return Promise.resolve(true);
    });
    const onAccessRejected = jest.fn();
    const transport = createHttpTransport({
      getAccessToken: () => token,
      refreshSession,
      onAccessRejected,
      baseUrl: 'http://api.test',
      fetch: fetchImpl as unknown as typeof fetch,
    });

    await expect(transport.requestJson('/accounts', schema)).resolves.toEqual(okBody);

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect((fetchImpl.mock.calls[1]?.[1]?.headers as Record<string, string>).Authorization).toBe(
      'Bearer fresh',
    );
    expect(onAccessRejected).not.toHaveBeenCalled();
  });

  it('signs out when the API still refuses after a successful refresh (e.g. no customer link)', async () => {
    const fetchImpl = jest.fn(() => Promise.resolve(json(401, { statusCode: 401 })));
    const onAccessRejected = jest.fn();
    const transport = createHttpTransport({
      getAccessToken: () => 'token',
      refreshSession: () => Promise.resolve(true),
      onAccessRejected,
      baseUrl: 'http://api.test',
      fetch: fetchImpl,
    });

    await expect(transport.requestJson('/accounts', schema)).rejects.toMatchObject({ status: 401 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onAccessRejected).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the refresh fails (the store has already handled the session)', async () => {
    const fetchImpl = jest.fn(() => Promise.resolve(json(401, { statusCode: 401 })));
    const onAccessRejected = jest.fn();
    const transport = createHttpTransport({
      getAccessToken: () => 'token',
      refreshSession: () => Promise.resolve(false),
      onAccessRejected,
      baseUrl: 'http://api.test',
      fetch: fetchImpl,
    });

    await expect(transport.requestJson('/accounts', schema)).rejects.toBeInstanceOf(ApiProblem);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onAccessRejected).not.toHaveBeenCalled();
  });

  it('gives up after the time limit with a no-response problem', async () => {
    const fetchImpl = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const transport = createHttpTransport({
      getAccessToken: () => undefined,
      baseUrl: 'http://api.test',
      timeoutMs: 20,
      fetch: fetchImpl as unknown as typeof fetch,
    });

    await expect(transport.requestJson('/public/rates', schema)).rejects.toMatchObject({
      name: 'ApiProblem',
      status: 0,
    });
  });

  it('keeps the 15 s default time limit', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(15_000);
  });
});
