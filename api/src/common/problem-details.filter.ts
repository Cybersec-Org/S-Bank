import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { StepUpRequiredException } from '../security/auth/step-up-required.exception.js';
import type { ProblemDetailsDto } from './problem-details.dto.js';
import {
  isUnexpectedFailure,
  problemTypeForStatus,
  STEP_UP_REQUIRED,
  UNAUTHORIZED_STATUS,
  VALIDATION_FAILED,
} from './problem-types.js';
import { REQUEST_ID_HEADER, requestIdFrom } from './request-id.js';

const PROBLEM_JSON = 'application/problem+json';
const MAX_REPORTED_VALIDATION_ERRORS = 20;
const MAX_VALIDATION_ERROR_LENGTH = 200;

/**
 * Turns every error into RFC 9457 problem details. Bodies are built from fixed texts per status:
 * exception messages, stack traces and internal ids never reach the client.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    if (response.headersSent) {
      return;
    }

    const traceId = requestIdOf(request);
    const status = statusOf(exception);
    const problem = buildProblem(exception, status, traceId);

    if (isUnexpectedFailure(status)) {
      this.logger.error(
        `Unhandled exception on ${request.method} (traceId=${traceId})`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    setChallengeHeader(response, exception, status);
    response.setHeader(REQUEST_ID_HEADER, traceId);
    response.status(status).type(PROBLEM_JSON).json(problem);
  }
}

/** The id assigned by the request logger, or a fresh one when the error happened before it ran. */
function requestIdOf(request: Request): string {
  if ('id' in request && typeof request.id === 'string') {
    return request.id;
  }
  return requestIdFrom(request);
}

function statusOf(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  // Errors from the body parser (malformed JSON, payload too large) carry their own 4xx status.
  if (typeof exception === 'object' && exception !== null && 'status' in exception) {
    const { status } = exception;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return status;
    }
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

function buildProblem(exception: unknown, status: number, traceId: string): ProblemDetailsDto {
  if (exception instanceof StepUpRequiredException) {
    return {
      ...STEP_UP_REQUIRED,
      status,
      detail: 'A fresh passkey authentication is required for this operation.',
      traceId,
      requiredAcr: exception.requiredAcr,
      maxAgeSeconds: exception.maxAgeSeconds,
    };
  }
  if (exception instanceof BadRequestException) {
    const errors = validationErrorsOf(exception);
    if (errors) {
      return { ...VALIDATION_FAILED, status, traceId, errors };
    }
  }
  return { ...problemTypeForStatus(status), status, traceId };
}

/** `ValidationPipe` reports failures as `message: string[]`. */
function validationErrorsOf(exception: BadRequestException): string[] | undefined {
  const body = exception.getResponse();
  if (typeof body !== 'object' || !('message' in body) || !Array.isArray(body.message)) {
    return undefined;
  }
  return body.message
    .filter((message): message is string => typeof message === 'string')
    .slice(0, MAX_REPORTED_VALIDATION_ERRORS)
    .map((message) => message.slice(0, MAX_VALIDATION_ERROR_LENGTH));
}

function setChallengeHeader(response: Response, exception: unknown, status: number): void {
  if (exception instanceof StepUpRequiredException) {
    response.setHeader(
      'WWW-Authenticate',
      `Bearer error="insufficient_user_authentication", acr_values="${exception.requiredAcr}", max_age="${exception.maxAgeSeconds}"`,
    );
  } else if (status === UNAUTHORIZED_STATUS) {
    response.setHeader('WWW-Authenticate', 'Bearer');
  }
}
