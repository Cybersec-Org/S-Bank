import { z } from 'zod';

import { pl } from '@/shared/i18n/pl';

import { NotImplementedYet } from './not-implemented';

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE = 422;
const HTTP_BAD_REQUEST = 400;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_MIN = 500;

/** Problems the app has a specific Polish message for. */
export const PROBLEM_CODES = [
  'step_up_required',
  'insufficient_funds',
  'daily_limit_exceeded',
  'invalid_iban',
  'request_expired',
  'account_blocked',
] as const;
export type ProblemCode = (typeof PROBLEM_CODES)[number];

/** RFC 9457 problem details as sent by the API. Only these members are read; `detail` is never shown. */
const problemBodySchema = z.object({
  type: z.string().optional(),
  title: z.string().optional(),
  status: z.number().int().optional(),
});

const PROBLEM_TYPE_PREFIX = '/problems/';

export interface ApiProblemInit {
  readonly status: number;
  readonly code?: ProblemCode | undefined;
  readonly title?: string | undefined;
  readonly type?: string | undefined;
}

/** A failed API call. Carries no request or response payload, so it is safe to log and render. */
export class ApiProblem extends Error {
  readonly status: number;
  readonly code: ProblemCode | undefined;
  readonly type: string | undefined;

  constructor(init: ApiProblemInit) {
    super(init.title ?? `API problem ${init.status}`);
    this.name = 'ApiProblem';
    this.status = init.status;
    this.code = init.code;
    this.type = init.type;
  }
}

function toKnownCode(code: string | undefined): ProblemCode | undefined {
  return PROBLEM_CODES.find((known) => known === code);
}

/** The API identifies a problem by its `type` URI (`/problems/step-up-required`); the code is that slug in snake_case. */
function codeFromType(type: string | undefined): ProblemCode | undefined {
  if (type === undefined || !type.startsWith(PROBLEM_TYPE_PREFIX)) {
    return undefined;
  }
  return toKnownCode(type.slice(PROBLEM_TYPE_PREFIX.length).replaceAll('-', '_'));
}

/** Maps a response body (any shape) and its HTTP status to a typed `ApiProblem`. */
export function parseProblem(body: unknown, httpStatus: number): ApiProblem {
  const parsed = problemBodySchema.safeParse(body);
  if (!parsed.success) {
    return new ApiProblem({ status: httpStatus });
  }
  return new ApiProblem({
    status: httpStatus,
    code: codeFromType(parsed.data.type),
    title: parsed.data.title,
    type: parsed.data.type,
  });
}

export function isApiProblem(error: unknown): error is ApiProblem {
  return error instanceof ApiProblem;
}

const CODE_MESSAGES: Readonly<Record<ProblemCode, string>> = {
  step_up_required: pl.errors.stepUpRequired,
  insufficient_funds: pl.errors.insufficientFunds,
  daily_limit_exceeded: pl.errors.dailyLimitExceeded,
  invalid_iban: pl.errors.invalidIban,
  request_expired: pl.errors.requestExpired,
  account_blocked: pl.errors.accountBlocked,
};

function messageForStatus(status: number): string {
  switch (status) {
    case HTTP_BAD_REQUEST:
    case HTTP_UNPROCESSABLE:
      return pl.errors.validation;
    case HTTP_UNAUTHORIZED:
      return pl.errors.unauthorized;
    case HTTP_FORBIDDEN:
      return pl.errors.forbidden;
    case HTTP_NOT_FOUND:
      return pl.errors.notFound;
    case HTTP_CONFLICT:
      return pl.errors.conflict;
    case HTTP_TOO_MANY_REQUESTS:
      return pl.errors.tooManyRequests;
    default:
      return status >= HTTP_SERVER_ERROR_MIN ? pl.errors.server : pl.errors.generic;
  }
}

/** Polish, user-safe description of any error; server-provided text is never displayed. */
export function describeProblem(error: unknown): string {
  if (error instanceof NotImplementedYet) {
    return pl.errors.notImplementedYet(error.backlogId);
  }
  if (error instanceof ApiProblem) {
    return error.code === undefined ? messageForStatus(error.status) : CODE_MESSAGES[error.code];
  }
  return pl.errors.generic;
}

export function isNotFoundProblem(error: unknown): boolean {
  return error instanceof ApiProblem && error.status === HTTP_NOT_FOUND;
}
