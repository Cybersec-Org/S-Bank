import { z } from 'zod';

import { env } from '@/shared/config/env';
import { groszeToZloty, jsonAmountToGrosze } from '@/shared/lib/money';

import type { AccessTokenProvider } from './client';
import { ApiProblem, HTTP_NO_RESPONSE, parseProblem } from './problem';

const HTTP_UNAUTHORIZED = 401;
export const REQUEST_TIMEOUT_MS = 15_000;

export interface HttpTransport {
  requestJson: <T>(
    path: string,
    schema: z.ZodType<T>,
    init?: {
      readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
      readonly body?: unknown;
    },
  ) => Promise<T>;
}

export interface HttpTransportOptions {
  /** Current in-memory access token. */
  readonly getAccessToken: AccessTokenProvider;
  /**
   * Called once on a 401: refreshes the session (one shared refresh for all requests, see SessionStore.refresh).
   * `true` = a new access token is available and the request is retried once.
   */
  readonly refreshSession?: (() => Promise<boolean>) | undefined;
  /** A 401 that survives a successful refresh: the API refuses this identity (e.g. no customer link). */
  readonly onAccessRejected?: (() => void) | undefined;
  readonly baseUrl?: string | undefined;
  readonly timeoutMs?: number | undefined;
  /** Injected in tests; defaults to the global `fetch`. */
  readonly fetch?: typeof fetch | undefined;
}

/**
 * Shared JSON/Bearer transport used by all `*.http.ts` feature repositories in live mode.
 * - every request is aborted after 15 s (`ApiProblem` with status 0);
 * - a 401 triggers one session refresh and one retry; a second 401 signs the user out (`onAccessRejected`);
 * - nothing about the request or the response is logged.
 */
export function createHttpTransport(options: HttpTransportOptions): HttpTransport {
  const baseUrl = (options.baseUrl ?? env.apiBaseUrl).replace(/\/$/, '');
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const fetchImpl = options.fetch ?? fetch;

  async function send(
    path: string,
    init: { readonly method?: string; readonly body?: unknown },
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = options.getAccessToken();
    if (token !== undefined) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (init.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(`${baseUrl}${path}`, {
        method: init.method ?? 'GET',
        headers,
        signal: controller.signal,
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      });
    } catch {
      // Timeout (abort), offline, DNS or refused connection: no HTTP response at all.
      throw new ApiProblem({ status: HTTP_NO_RESPONSE });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async requestJson<T>(
      path: string,
      schema: z.ZodType<T>,
      init: { readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; readonly body?: unknown } = {},
    ): Promise<T> {
      let response = await send(path, init);

      if (response.status === HTTP_UNAUTHORIZED && options.refreshSession !== undefined) {
        const refreshed = await options.refreshSession();
        if (refreshed) {
          response = await send(path, init);
          if (response.status === HTTP_UNAUTHORIZED) {
            options.onAccessRejected?.();
          }
        }
      }

      const raw: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        throw parseProblem(raw, response.status);
      }

      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(`Invalid API response schema for ${path}`);
      }
      return parsed.data;
    },
  };
}

/** API amount (PLN as a JSON number) to grosze, exactly; see `jsonAmountToGrosze`. */
export function plnToGrosze(pln: number): number {
  return jsonAmountToGrosze(pln);
}

/** Grosze to the API's PLN number for request bodies (at most two decimals, e.g. 1250 → 12.5). */
export function groszeToPln(grosze: number): number {
  return groszeToZloty(grosze);
}

export const voidResponseSchema = z.unknown();
