import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ProblemDetailsDto } from './problem-details.dto.js';

export type DocumentedProblemStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429;

const PROBLEM_DESCRIPTIONS: ReadonlyMap<DocumentedProblemStatus, string> = new Map([
  [400, 'Validation failed or malformed request.'],
  [401, 'Missing, invalid or expired access token.'],
  [403, 'Role not allowed, or step-up authentication required.'],
  [404, 'Resource not found (also returned for resources of other users).'],
  [409, 'Conflict with the current state of the resource.'],
  [422, 'The request is well formed but cannot be processed.'],
  [429, 'Too many requests.'],
]);

/** Documents RFC 9457 error responses (`application/problem+json`) for the given statuses. */
export function ApiProblemResponses(...statuses: readonly DocumentedProblemStatus[]) {
  return applyDecorators(
    ApiExtraModels(ProblemDetailsDto),
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: PROBLEM_DESCRIPTIONS.get(status) ?? 'Error.',
        content: {
          'application/problem+json': { schema: { $ref: getSchemaPath(ProblemDetailsDto) } },
        },
      }),
    ),
  );
}
