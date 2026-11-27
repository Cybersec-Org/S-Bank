import {
  convertGroszeToForeignMinorUnits,
  formatAmountInput,
  formatMoney,
  formatScaledRate,
  formatSignedMoney,
  formatWholeMoney,
  jsonAmountToGrosze,
  parseAmountToGrosze,
} from './money';

const NBSP = ' ';

describe('jsonAmountToGrosze', () => {
  it('converts API amounts exactly, without floating-point multiplication', () => {
    expect(jsonAmountToGrosze(12500)).toBe(1_250_000);
    expect(jsonAmountToGrosze(1850.5)).toBe(185_050);
    expect(jsonAmountToGrosze(0.01)).toBe(1);
    expect(jsonAmountToGrosze(1.1)).toBe(110);
    // 1.15 * 100 is 114.99999999999999 in floating point; the text-based parser is exact.
    expect(jsonAmountToGrosze(1.15)).toBe(115);
    expect(jsonAmountToGrosze(-25.4)).toBe(-2540);
    expect(jsonAmountToGrosze(0)).toBe(0);
  });

  it('refuses amounts it cannot represent exactly instead of rounding them', () => {
    expect(() => jsonAmountToGrosze(10.005)).toThrow(RangeError);
    expect(() => jsonAmountToGrosze(1e21)).toThrow(RangeError);
    expect(() => jsonAmountToGrosze(Number.NaN)).toThrow(RangeError);
    expect(() => jsonAmountToGrosze(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('formatMoney', () => {
  it.each([
    [0, `0,00${NBSP}zł`],
    [5, `0,05${NBSP}zł`],
    [1250, `12,50${NBSP}zł`],
    [100_000, `1${NBSP}000,00${NBSP}zł`],
    [123_456_789, `1${NBSP}234${NBSP}567,89${NBSP}zł`],
    [-1250, `\u221212,50${NBSP}zł`],
  ])('formats %i grosze as %s', (grosze, expected) => {
    expect(formatMoney(grosze)).toBe(expected);
  });

  it('uses the currency code for foreign currencies', () => {
    expect(formatMoney(12_345, 'EUR')).toBe(`123,45${NBSP}EUR`);
  });

  it('rejects non-integer amounts instead of rounding them silently', () => {
    expect(() => formatMoney(12.5)).toThrow(RangeError);
  });
});

describe('formatSignedMoney', () => {
  it('puts a plus before incoming amounts and the typographic minus before outgoing ones', () => {
    expect(formatSignedMoney(540_000)).toBe(`+5${NBSP}400,00${NBSP}zł`);
    expect(formatSignedMoney(-1840)).toBe(`\u221218,40${NBSP}zł`);
    expect(formatSignedMoney(0)).toBe(`0,00${NBSP}zł`);
  });
});

describe('formatWholeMoney', () => {
  it('drops empty grosze and keeps real ones', () => {
    expect(formatWholeMoney(500_000)).toBe(`5${NBSP}000${NBSP}zł`);
    expect(formatWholeMoney(500_050)).toBe(`5${NBSP}000,50${NBSP}zł`);
  });
});

describe('formatAmountInput', () => {
  it('gives the plain decimal-comma form used to pre-fill a field', () => {
    expect(formatAmountInput(428_015)).toBe('4280,15');
    expect(formatAmountInput(5)).toBe('0,05');
  });
});

describe('parseAmountToGrosze', () => {
  it.each([
    ['12,50', 1250],
    ['12.50', 1250],
    ['12,5', 1250],
    ['12', 1200],
    ['0,01', 1],
    ['1 200,00', 120_000],
    [`1${NBSP}200`, 120_000],
    ['  7,00  ', 700],
  ])('parses %s as %i grosze', (input, expected) => {
    expect(parseAmountToGrosze(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '12,505', '1,2,3', ',50', '12 zł', '9'.repeat(13)])(
    'rejects %s',
    (input) => {
      expect(parseAmountToGrosze(input)).toBeNull();
    },
  );
});

describe('convertGroszeToForeignMinorUnits', () => {
  it('converts at the mid rate and rounds half up using integers only', () => {
    expect(convertGroszeToForeignMinorUnits(100_000, 42_315)).toBe(23_632);
  });

  it('rounds exactly half up', () => {
    expect(convertGroszeToForeignMinorUnits(1, 20_000)).toBe(1);
    expect(convertGroszeToForeignMinorUnits(1, 20_001)).toBe(0);
  });

  it('rejects invalid inputs', () => {
    expect(() => convertGroszeToForeignMinorUnits(-1, 42_315)).toThrow(RangeError);
    expect(() => convertGroszeToForeignMinorUnits(100, 0)).toThrow(RangeError);
  });
});

describe('formatScaledRate', () => {
  it('shows four decimals', () => {
    expect(formatScaledRate(42_315)).toBe('4,2315');
    expect(formatScaledRate(1_735)).toBe('0,1735');
  });
});
