import { formatDate, formatDateTime, isExpired, isIsoDate, toBankDay } from './dates';

describe('isIsoDate', () => {
  it.each(['2026-10-15', '2024-02-29'])('accepts %s', (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each(['', '2026-13-01', '2026-02-30', '2025-02-29', '15.10.2026', '2026-1-1'])(
    'rejects %s',
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    },
  );
});

describe('formatting in the bank time zone', () => {
  it('formats a date as DD.MM.YYYY', () => {
    expect(formatDate('2026-10-15T09:00:00.000Z')).toBe('15.10.2026');
  });

  it('formats a timestamp with the 24-hour clock in Warsaw time', () => {
    expect(formatDateTime('2026-10-15T09:30:00.000Z')).toContain('11:30');
  });

  it('assigns late-evening UTC timestamps to the next local day', () => {
    expect(toBankDay('2026-10-14T22:30:00.000Z')).toBe('2026-10-15');
  });
});

describe('isExpired', () => {
  it('is true at and after the expiry instant', () => {
    const now = new Date('2026-10-15T09:00:00.000Z');
    expect(isExpired('2026-10-15T09:00:00.000Z', now)).toBe(true);
    expect(isExpired('2026-10-15T09:00:01.000Z', now)).toBe(false);
  });
});
