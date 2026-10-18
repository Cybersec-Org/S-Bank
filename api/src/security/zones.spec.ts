import { describe, expect, it } from 'vitest';
import { resolveZone } from './zones.js';

describe('resolveZone', () => {
  it.each([
    ['/public/rates', 'public'],
    ['/public', 'public'],
    ['/public/docs', 'public'],
    ['/api/me', 'api'],
    ['/api', 'api'],
    ['/partner/payment-requests', 'partner'],
    ['/health', 'internal'],
    ['/health/', 'internal'],
    ['/API/ME', 'api'],
    ['/Partner/x', 'partner'],
  ])('maps %s to the %s zone', (path, zone) => {
    expect(resolveZone(path)).toBe(zone);
  });

  it.each(['/', '/apiary', '/publicity/x', '/admin', '/healthz', '/health/details', '//api/me'])(
    'maps %s to no zone',
    (path) => {
      expect(resolveZone(path)).toBeUndefined();
    },
  );
});
