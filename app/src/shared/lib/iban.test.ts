import { FAKE_IBANS } from '@/shared/api/mock/mock-data';

import { formatIban, ibanEnding, isValidPolishIban, maskIban, normalizeIban } from './iban';

describe('isValidPolishIban', () => {
  it('accepts every IBAN used by the mock data', () => {
    Object.values(FAKE_IBANS).forEach((iban) => {
      expect(isValidPolishIban(iban)).toBe(true);
    });
  });

  it('accepts a spaced, lower-case input', () => {
    expect(isValidPolishIban('pl96 1234 5678 0000 0000 0000 0001')).toBe(true);
  });

  it('rejects a wrong checksum', () => {
    expect(isValidPolishIban('PL97123456780000000000000001')).toBe(false);
  });

  it.each([
    '',
    'PL96',
    'DE89370400440532013000',
    'PL9612345678000000000000000X',
    `${FAKE_IBANS.customerMain}0`,
  ])('rejects malformed value %s', (input) => {
    expect(isValidPolishIban(input)).toBe(false);
  });
});

describe('IBAN display helpers', () => {
  it('normalizes whitespace and case', () => {
    expect(normalizeIban(' pl96 1234\t5678 ')).toBe('PL9612345678');
  });

  it('groups in blocks of four', () => {
    expect(formatIban(FAKE_IBANS.customerMain)).toBe('PL96 1234 5678 0000 0000 0000 0001');
  });

  it('masks everything except the country and the last four characters', () => {
    const masked = maskIban(FAKE_IBANS.customerMain);
    expect(masked).toBe('PL•• •••• •••• •••• •••• •••• 0001');
    expect(masked).not.toContain('1234');
  });

  it('exposes only the ending for accessible labels', () => {
    expect(ibanEnding(FAKE_IBANS.customerSavings)).toBe('0002');
  });

  it('masks very short values completely', () => {
    expect(maskIban('PL12')).toBe('••••');
  });
});
