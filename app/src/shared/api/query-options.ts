/** Sensitive data (balances, history) is dropped from the in-memory cache soon after screens unmount. */
export const SENSITIVE_QUERY_GC_TIME_MS = 60_000;

export const SENSITIVE_QUERY_OPTIONS = {
  gcTime: SENSITIVE_QUERY_GC_TIME_MS,
} as const;
