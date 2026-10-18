import { describe, expect, it } from 'vitest';
import { requestIdFrom, resolveRequestId } from './request-id.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('resolveRequestId', () => {
  it('keeps a well formed caller id', () => {
    expect(resolveRequestId('req-1234.ABCD_efgh')).toBe('req-1234.ABCD_efgh');
  });

  it.each([
    ['missing', undefined],
    ['too short', 'abc'],
    ['too long', 'a'.repeat(65)],
    ['with a newline (log injection)', 'abcdefgh\nINFO fake entry'],
    ['with spaces', 'abcd efgh'],
    ['repeated header', ['abcdefgh', 'ijklmnop']],
  ])('generates a UUID when the id is %s', (_label, candidate) => {
    expect(resolveRequestId(candidate)).toMatch(UUID_PATTERN);
  });
});

describe('requestIdFrom', () => {
  it('reads the x-request-id header', () => {
    const request = { headers: { 'x-request-id': 'trace-from-caller' } };

    expect(requestIdFrom(request as never)).toBe('trace-from-caller');
  });
});
