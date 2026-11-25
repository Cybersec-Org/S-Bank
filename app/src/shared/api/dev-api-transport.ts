import type { z } from 'zod';

import type { DevApiIdentity } from '@/shared/auth/dev-api-identity';

import { ApiProblem, HTTP_BAD_GATEWAY, HTTP_NO_RESPONSE, parseProblem } from './problem';

type HttpMethod = 'GET' | 'POST' | 'PATCH';
type QueryValue = string | number | undefined;

export interface DevApiTransportOptions {
  readonly baseUrl: string;
  /** Identity of the signed-in demo user, or `null` when nobody is signed in. */
  readonly getIdentity: () => DevApiIdentity | null;
  /** Injected in tests; defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
}

export interface DevApiRequest<T> {
  readonly method: HttpMethod;
  readonly path: string;
  /** Every response body is validated; a mismatch is treated as a server error. */
  readonly schema: z.ZodType<T>;
  readonly query?: Readonly<Record<string, QueryValue>>;
  readonly body?: unknown;
}

export interface DevApiTransport {
  request: <T>(request: DevApiRequest<T>) => Promise<T>;
}

const NO_BODY: unknown = undefined;

function buildUrl(baseUrl: string, path: string, query: DevApiRequest<unknown>['query']): string {
  const base = baseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  const search = params.toString();
  return `${base}${path}${search === '' ? '' : `?${search}`}`;
}

/** Path segment from an id; ids come from the API, but they are encoded so a value can never change the route. */
export function pathSegment(id: string): string {
  return encodeURIComponent(id);
}

/**
 * JSON transport for the development API (hybrid mode). Identity travels in `x-user-id` / `x-user-role`
 * because that API has no real sign-in yet. Nothing from a request or response is logged or kept in errors.
 */
export function createDevApiTransport(options: DevApiTransportOptions): DevApiTransport {
  const fetchImpl = options.fetch ?? fetch;

  return {
    request: async <T>({ method, path, schema, query, body }: DevApiRequest<T>): Promise<T> => {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }
      const identity = options.getIdentity();
      if (identity !== null) {
        headers['x-user-id'] = identity.userId;
        headers['x-user-role'] = identity.role;
      }

      let response: Response;
      try {
        response = await fetchImpl(buildUrl(options.baseUrl, path, query), {
          method,
          headers,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      } catch {
        throw new ApiProblem({ status: HTTP_NO_RESPONSE });
      }

      const json: unknown = await response.json().catch(() => NO_BODY);
      if (!response.ok) {
        throw parseProblem(json, response.status);
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new ApiProblem({ status: HTTP_BAD_GATEWAY });
      }
      return parsed.data;
    },
  };
}
