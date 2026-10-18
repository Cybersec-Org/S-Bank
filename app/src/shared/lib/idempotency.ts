import { randomUUID } from 'expo-crypto';

/** One key per user intent; callers keep it and reuse it when retrying the same request. */
export function createIdempotencyKey(): string {
  return randomUUID();
}
