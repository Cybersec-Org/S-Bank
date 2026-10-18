import { QueryClient } from '@tanstack/react-query';

import { ApiProblem } from './problem';

const DEFAULT_STALE_TIME_MS = 30_000;
const DEFAULT_RETRY_COUNT = 1;
const HTTP_SERVER_ERROR_MIN = 500;

/** Client errors (4xx) will not change on a retry; only transient failures are retried once. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiProblem && error.status < HTTP_SERVER_ERROR_MIN) {
    return false;
  }
  return failureCount < DEFAULT_RETRY_COUNT;
}

/** In-memory only: no persistence plugin, so financial data never reaches device storage. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: DEFAULT_STALE_TIME_MS },
    },
  });
}
