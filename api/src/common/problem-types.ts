import { HttpStatus } from '@nestjs/common';

export interface ProblemType {
  readonly type: string;
  readonly title: string;
}

const PROBLEM_TYPE_PREFIX = '/problems/';

function problemType(slug: string, title: string): ProblemType {
  return { type: `${PROBLEM_TYPE_PREFIX}${slug}`, title };
}

export const VALIDATION_FAILED = problemType('validation-failed', 'Validation failed');
export const STEP_UP_REQUIRED = problemType('step-up-required', 'Step-up authentication required');
export const INTERNAL_ERROR = problemType('internal-error', 'Internal server error');

const PROBLEM_TYPES_BY_STATUS: ReadonlyMap<number, ProblemType> = new Map([
  [HttpStatus.BAD_REQUEST, problemType('bad-request', 'Bad request')],
  [HttpStatus.UNAUTHORIZED, problemType('unauthorized', 'Unauthorized')],
  [HttpStatus.FORBIDDEN, problemType('forbidden', 'Forbidden')],
  [HttpStatus.NOT_FOUND, problemType('not-found', 'Not found')],
  [HttpStatus.CONFLICT, problemType('conflict', 'Conflict')],
  [HttpStatus.PAYLOAD_TOO_LARGE, problemType('payload-too-large', 'Payload too large')],
  [
    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    problemType('unsupported-media-type', 'Unsupported media type'),
  ],
  [HttpStatus.UNPROCESSABLE_ENTITY, problemType('unprocessable-content', 'Unprocessable content')],
  [HttpStatus.TOO_MANY_REQUESTS, problemType('too-many-requests', 'Too many requests')],
  [HttpStatus.SERVICE_UNAVAILABLE, problemType('service-unavailable', 'Service unavailable')],
]);

export const UNAUTHORIZED_STATUS = 401;
const INTERNAL_SERVER_ERROR_STATUS = 500;
const SERVICE_UNAVAILABLE_STATUS = 503;

/** Server-side faults whose details must stay in the log: every 5xx except a deliberate 503. */
export function isUnexpectedFailure(status: number): boolean {
  return status >= INTERNAL_SERVER_ERROR_STATUS && status !== SERVICE_UNAVAILABLE_STATUS;
}

const REJECTED_REQUEST = problemType('request-rejected', 'Request rejected');

/** Fixed problem type per status, so error bodies never depend on exception message text. */
export function problemTypeForStatus(status: number): ProblemType {
  if (isUnexpectedFailure(status)) {
    return INTERNAL_ERROR;
  }
  return PROBLEM_TYPES_BY_STATUS.get(status) ?? REJECTED_REQUEST;
}
