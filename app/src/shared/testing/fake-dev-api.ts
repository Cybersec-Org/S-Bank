import { createDevApiTransport, type DevApiTransport } from '@/shared/api/dev-api-transport';
import type { DevApiIdentity } from '@/shared/auth/dev-api-identity';

export const FAKE_DEV_API_URL = 'http://dev-api.test';

export interface RecordedRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

export interface FakeResponse {
  readonly status?: number;
  readonly body: unknown;
}

/** `METHOD /path` (without the query string) mapped to the response the fake dev API gives. */
export type FakeRoutes = Readonly<Record<string, FakeResponse>>;

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

/** Transport wired to an in-memory router, recording every request it receives. */
export function createFakeDevApi(
  routes: FakeRoutes,
  identity: DevApiIdentity | null = { userId: 'client-1', role: 'CLIENT' },
): { transport: DevApiTransport; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  const fakeFetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    const method = init?.method ?? 'GET';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    requests.push({ method, url, headers, body });
    const path = new URL(url).pathname;
    const route = routes[`${method} ${path}`];
    const status = route?.status ?? (route === undefined ? HTTP_NOT_FOUND : HTTP_OK);
    return Promise.resolve(
      new Response(JSON.stringify(route?.body ?? { statusCode: HTTP_NOT_FOUND }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };
  return {
    transport: createDevApiTransport({
      baseUrl: FAKE_DEV_API_URL,
      getIdentity: () => identity,
      fetch: fakeFetch,
    }),
    requests,
  };
}

/** Account as the dev API serialises it (`accounts.service.ts#serializeAccount`). */
export function devApiAccount(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    iban: 'PL04102010260000140202736451',
    ownerId: 'client-1',
    currency: 'PLN',
    balance: 4750.5,
    dailyLimit: 2000,
    dailyUsed: 250,
    status: 'ACTIVE',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    ownerFirstName: 'Jan',
    ownerLastName: 'Kowalski',
    ...overrides,
  };
}

/** Completed transaction row as the dev API returns it. */
export function devApiTransaction(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    operationNumber: 'OP-SEED-001',
    senderAccountId: '11111111-1111-4111-8111-111111111111',
    receiverAccountId: '33333333-3333-4333-8333-333333333333',
    receiverIban: 'PL47102010260000140202736453',
    receiverName: 'Anna Nowak',
    amount: 250,
    currency: 'PLN',
    title: 'Initial seed transfer',
    status: 'COMPLETED',
    createdAt: '2026-11-10T09:00:00.000Z',
    executedAt: '2026-11-10T09:00:05.000Z',
    ...overrides,
  };
}
