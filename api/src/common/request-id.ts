import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Caller-supplied ids are only trusted when they cannot be used for log injection. */
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

/** Returns the caller's request id when it is well formed, otherwise a fresh random UUID. */
export function resolveRequestId(candidate: string | readonly string[] | undefined): string {
  if (typeof candidate === 'string' && SAFE_REQUEST_ID_PATTERN.test(candidate)) {
    return candidate;
  }
  return randomUUID();
}

/** The request id for a request: the caller's if well formed, otherwise a fresh one. */
export function requestIdFrom(request: IncomingMessage): string {
  return resolveRequestId(request.headers['x-request-id']);
}
