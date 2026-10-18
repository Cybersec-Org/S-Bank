import { isUuid } from './ids';

describe('isUuid', () => {
  it('accepts a v4 UUID in any case', () => {
    expect(isUuid('3f2b8c1e-5d4a-4c7b-9a1e-0b6d2f8e7a10')).toBe(true);
    expect(isUuid('3F2B8C1E-5D4A-4C7B-9A1E-0B6D2F8E7A10')).toBe(true);
  });

  it.each(['', 'abc', '../../etc/hosts', '3f2b8c1e-5d4a-4c7b-9a1e-0b6d2f8e7a1', 'x'.repeat(36)])(
    'rejects %s',
    (value) => {
      expect(isUuid(value)).toBe(false);
    },
  );

  it('rejects non-string input such as repeated query parameters', () => {
    expect(isUuid(['3f2b8c1e-5d4a-4c7b-9a1e-0b6d2f8e7a10'])).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
