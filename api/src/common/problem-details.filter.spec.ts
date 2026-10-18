import {
  type ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepUpRequiredException } from '../security/auth/step-up-required.exception.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';

interface RecordedResponse {
  statusCode?: number;
  contentType?: string;
  body?: Record<string, unknown>;
  headers: Map<string, string>;
}

function runFilter(
  exception: unknown,
  requestOverrides: Record<string, unknown> = {},
): RecordedResponse {
  const recorded: RecordedResponse = { headers: new Map() };
  const response = {
    headersSent: false,
    setHeader(name: string, value: string) {
      recorded.headers.set(name, value);
    },
    status(code: number) {
      recorded.statusCode = code;
      return response;
    },
    type(contentType: string) {
      recorded.contentType = contentType;
      return response;
    },
    json(body: Record<string, unknown>) {
      recorded.body = body;
    },
  };
  const request = { method: 'GET', headers: {}, id: 'trace-from-logger-1', ...requestOverrides };
  const host = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;

  new ProblemDetailsFilter().catch(exception, host);
  return recorded;
}

describe('ProblemDetailsFilter', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers with application/problem+json and the request id as traceId', () => {
    const result = runFilter(new ForbiddenException());

    expect(result.statusCode).toBe(403);
    expect(result.contentType).toBe('application/problem+json');
    expect(result.body).toEqual({
      type: '/problems/forbidden',
      title: 'Forbidden',
      status: 403,
      traceId: 'trace-from-logger-1',
    });
    expect(result.headers.get('x-request-id')).toBe('trace-from-logger-1');
  });

  it('falls back to the caller header, then to a generated id, before the logger assigned one', () => {
    const fromHeader = runFilter(new ForbiddenException(), {
      id: undefined,
      headers: { 'x-request-id': 'caller-supplied-id' },
    });
    const generated = runFilter(new ForbiddenException(), { id: undefined, headers: {} });

    expect(fromHeader.body?.['traceId']).toBe('caller-supplied-id');
    expect(generated.body?.['traceId']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('challenges unauthenticated callers with a Bearer scheme', () => {
    const result = runFilter(new UnauthorizedException());

    expect(result.statusCode).toBe(401);
    expect(result.headers.get('WWW-Authenticate')).toBe('Bearer');
  });

  it('does not echo the exception message of client errors', () => {
    const result = runFilter(new NotFoundException('Cannot GET /api/secret-path?token=abc'));

    expect(JSON.stringify(result.body)).not.toContain('secret-path');
    expect(result.body).toMatchObject({ type: '/problems/not-found', status: 404 });
  });

  it('reports validation failures as a list without echoing values', () => {
    const result = runFilter(
      new BadRequestException({
        message: ['property extra should not exist', 'amountGrosze must be an integer number'],
        error: 'Bad Request',
        statusCode: 400,
      }),
    );

    expect(result.body).toMatchObject({
      type: '/problems/validation-failed',
      status: 400,
      errors: ['property extra should not exist', 'amountGrosze must be an integer number'],
    });
  });

  it('limits how many validation messages are returned', () => {
    const messages = Array.from({ length: 100 }, (_, index) => `field${index} is invalid`);

    const result = runFilter(new BadRequestException({ message: messages }));

    expect(result.body?.['errors']).toHaveLength(20);
  });

  it('reports step-up requirements with the RFC 9470 challenge', () => {
    const result = runFilter(new StepUpRequiredException('2', 300));

    expect(result.statusCode).toBe(403);
    expect(result.body).toMatchObject({
      type: '/problems/step-up-required',
      requiredAcr: '2',
      maxAgeSeconds: 300,
    });
    expect(result.headers.get('WWW-Authenticate')).toBe(
      'Bearer error="insufficient_user_authentication", acr_values="2", max_age="300"',
    );
  });

  it('maps body parser errors to their own 4xx status', () => {
    const result = runFilter(Object.assign(new Error('request entity too large'), { status: 413 }));

    expect(result.statusCode).toBe(413);
    expect(result.body).toMatchObject({ type: '/problems/payload-too-large' });
    expect(JSON.stringify(result.body)).not.toContain('entity');
  });

  it('never leaks the message or stack of unexpected errors', () => {
    const failure = new Error('connect ECONNREFUSED 10.0.0.5:5432 password=hunter2');

    const result = runFilter(failure);

    const serialized = JSON.stringify(result.body);
    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({
      type: '/problems/internal-error',
      title: 'Internal server error',
    });
    expect(serialized).not.toContain('ECONNREFUSED');
    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('at ');
    expect(Object.keys(result.body ?? {}).sort()).toEqual(['status', 'title', 'traceId', 'type']);
  });

  it('logs unexpected errors server-side', () => {
    runFilter(new Error('boom'));

    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
  });

  it('does not log expected client errors as faults', () => {
    runFilter(new ForbiddenException());

    expect(Logger.prototype.error).not.toHaveBeenCalled();
  });

  it('keeps an intentional 503 distinct from internal errors', () => {
    const result = runFilter(new ServiceUnavailableException());

    expect(result.body).toMatchObject({ type: '/problems/service-unavailable', status: 503 });
    expect(Logger.prototype.error).not.toHaveBeenCalled();
  });

  it('does nothing when the response was already sent', () => {
    const response = { headersSent: true };
    const host = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }), getResponse: () => response }),
    } as unknown as ArgumentsHost;

    expect(() => new ProblemDetailsFilter().catch(new Error('late'), host)).not.toThrow();
  });
});
