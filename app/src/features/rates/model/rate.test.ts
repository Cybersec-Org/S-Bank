import { convertPlnToForeign } from './rate';

describe('convertPlnToForeign', () => {
  it('converts grosze to foreign cents at the scaled mid rate', () => {
    const euro = { code: 'EUR', name: 'euro', midRateScaled: 42_315 };

    expect(convertPlnToForeign(100_000, euro)).toBe(23_632);
  });

  it('handles currencies quoted far below one zloty', () => {
    const koruna = { code: 'CZK', name: 'korona czeska', midRateScaled: 1_735 };

    expect(convertPlnToForeign(100_000, koruna)).toBe(576_369);
  });
});
