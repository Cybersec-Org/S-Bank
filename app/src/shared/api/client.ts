import createClient, { type Middleware } from 'openapi-fetch';

import { parseProblem } from './problem';
import type { paths } from './schema';

/** Returns the in-memory access token, or `undefined` when nobody is signed in. */
export type AccessTokenProvider = () => string | undefined;

export interface ApiClientOptions {
  readonly baseUrl: string;
  readonly getAccessToken: AccessTokenProvider;
  /** Injected in tests; defaults to the global `fetch`. */
  readonly fetch?: (request: Request) => Promise<Response>;
}

const PROBLEM_BODY_UNREADABLE: unknown = undefined;

function bearerMiddleware(getAccessToken: AccessTokenProvider): Middleware {
  return {
    onRequest({ request }) {
      const token = getAccessToken();
      if (token !== undefined) {
        request.headers.set('Authorization', `Bearer ${token}`);
      }
      return request;
    },
  };
}

/** Failed calls become a typed `ApiProblem`; server-provided text is never kept for display. */
const problemMiddleware: Middleware = {
  async onResponse({ response }) {
    if (response.ok) {
      return undefined;
    }
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => PROBLEM_BODY_UNREADABLE);
    throw parseProblem(body, response.status);
  },
};

/** Typed client for the generated OpenAPI contract (`schema.d.ts`). Used only by `*.http.ts` repositories. */
export function createApiClient(options: ApiClientOptions) {
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  client.use(bearerMiddleware(options.getAccessToken), problemMiddleware);
  return client;
}
