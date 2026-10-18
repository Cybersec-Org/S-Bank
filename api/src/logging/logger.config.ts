import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import { REQUEST_ID_HEADER, requestIdFrom } from '../common/request-id.js';
import type { Env } from '../config/env.schema.js';

/** Secrets and financial data that must never reach the log (invariant 7). */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.accessToken',
  '*.refreshToken',
  '*.password',
  '*.iban',
  '*.balanceGrosze',
];

/** Health probes run every few seconds and carry no information worth logging. */
const UNLOGGED_PATH = '/health';

export function assignRequestId(request: IncomingMessage, response: ServerResponse): string {
  const requestId = requestIdFrom(request);
  response.setHeader(REQUEST_ID_HEADER, requestId);
  return requestId;
}

export function buildLoggerParams(logLevel: Env['LOG_LEVEL']): Params {
  return {
    pinoHttp: {
      level: logLevel,
      redact: LOG_REDACT_PATHS,
      genReqId: assignRequestId,
      autoLogging: { ignore: (request) => request.url === UNLOGGED_PATH },
    },
  };
}
