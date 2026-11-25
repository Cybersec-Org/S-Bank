import { z } from 'zod';

import { env } from '@/shared/config/env';

import type { AccessTokenProvider } from './client';
import { parseProblem } from './problem';

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

/** Shared JSON/Bearer transport used by all `*.http.ts` feature repositories in live mode. */
export function createHttpTransport(getAccessToken: AccessTokenProvider): HttpTransport {
  const baseUrl = env.apiBaseUrl.replace(/\/$/, '');

  return {
    async requestJson<T>(
      path: string,
      schema: z.ZodType<T>,
      init: { readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; readonly body?: unknown } = {},
    ): Promise<T> {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      const token = getAccessToken();
      if (token !== undefined) {
        headers.Authorization = `Bearer ${token}`;
      }
      if (init.body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(`${baseUrl}${path}`, {
        method: init.method ?? 'GET',
        headers,
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      });

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

export function plnToGrosze(pln: number): number {
  return Math.round(pln * 100);
}

export function groszeToPln(grosze: number): number {
  return Math.round(grosze) / 100;
}

export const voidResponseSchema = z.unknown();
