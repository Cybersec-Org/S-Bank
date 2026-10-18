import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { assignRequestId, buildLoggerParams, LOG_REDACT_PATHS } from './logger.config.js';

function captureLog(entry: Record<string, unknown>): string {
  const lines: string[] = [];
  const logger = pino({ redact: LOG_REDACT_PATHS }, { write: (line: string) => lines.push(line) });
  logger.info(entry, 'probe');
  return lines.join('');
}

describe('log redaction', () => {
  it('removes credentials and cookies from logged requests and responses', () => {
    const output = captureLog({
      req: { headers: { authorization: 'Bearer eyJ.secret.token', cookie: 'sid=secret-cookie' } },
      res: { headers: { 'set-cookie': 'sid=secret-set-cookie' } },
    });

    expect(output).not.toContain('eyJ.secret.token');
    expect(output).not.toContain('secret-cookie');
    expect(output).not.toContain('secret-set-cookie');
    expect(output).toContain('[Redacted]');
  });

  it('removes tokens, passwords, IBANs and balances from logged objects', () => {
    const output = captureLog({
      session: { accessToken: 'access-secret', refreshToken: 'refresh-secret' },
      login: { password: 'password-secret' },
      account: { iban: 'PL61109010140000071219812874', balanceGrosze: 123456789 },
    });

    for (const secret of [
      'access-secret',
      'refresh-secret',
      'password-secret',
      'PL61109010140000071219812874',
      '123456789',
    ]) {
      expect(output).not.toContain(secret);
    }
  });

  it('keeps unrelated fields', () => {
    expect(captureLog({ account: { currency: 'PLN' } })).toContain('PLN');
  });
});

describe('request id assignment', () => {
  it('echoes the request id in the response header', () => {
    const headers = new Map<string, string>();
    const response = { setHeader: (name: string, value: string) => headers.set(name, value) };

    const id = assignRequestId(
      { headers: { 'x-request-id': 'caller-id-12345' } } as never,
      response as never,
    );

    expect(id).toBe('caller-id-12345');
    expect(headers.get('x-request-id')).toBe('caller-id-12345');
  });
});

describe('buildLoggerParams', () => {
  it('uses the configured level and the shared redaction list', () => {
    const params = buildLoggerParams('warn');

    expect(params.pinoHttp).toMatchObject({ level: 'warn', redact: LOG_REDACT_PATHS });
  });
});
