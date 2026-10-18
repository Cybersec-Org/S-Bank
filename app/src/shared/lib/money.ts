/** Money is always an integer number of grosze; floats never represent an amount. */

export const GROSZE_PER_ZLOTY = 100;
export const DEFAULT_CURRENCY = 'PLN';

const NON_BREAKING_SPACE = ' ';
const THOUSANDS_GROUP_SIZE = 3;
const MAX_INPUT_INTEGER_DIGITS = 12;
export const RATE_SCALE = 10_000;
const AMOUNT_INPUT_PATTERN = new RegExp(
  `^(\\d{1,${MAX_INPUT_INTEGER_DIGITS}})(?:[.,](\\d{1,2}))?$`,
);

const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = { PLN: 'zł' };

function groupThousands(digits: string): string {
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= THOUSANDS_GROUP_SIZE) {
    groups.unshift(digits.slice(Math.max(0, end - THOUSANDS_GROUP_SIZE), end));
  }
  return groups.join(NON_BREAKING_SPACE);
}

/** Formats minor units (grosze for PLN) as `1 234,50 zł` without going through floating point. */
export function formatMoney(minorUnits: number, currency: string = DEFAULT_CURRENCY): string {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new RangeError('Amount must be a safe integer number of minor units');
  }
  const sign = minorUnits < 0 ? '-' : '';
  const absolute = Math.abs(minorUnits);
  const whole = Math.trunc(absolute / GROSZE_PER_ZLOTY);
  const fraction = String(absolute % GROSZE_PER_ZLOTY).padStart(2, '0');
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${sign}${groupThousands(String(whole))},${fraction}${NON_BREAKING_SPACE}${symbol}`;
}

/**
 * Parses user input such as `12,50`, `12.5` or `1 200` into grosze.
 * Returns null for anything that is not a non-negative amount with at most two decimals.
 */
export function parseAmountToGrosze(input: string): number | null {
  const compact = input.replace(/[\s ]/g, '');
  const match = AMOUNT_INPUT_PATTERN.exec(compact);
  if (match === null) {
    return null;
  }
  const [, whole = '', fraction = ''] = match;
  return Number(whole) * GROSZE_PER_ZLOTY + Number(fraction.padEnd(2, '0'));
}

/**
 * Converts grosze to minor units of a foreign currency given an NBP mid rate scaled by 10 000
 * (4.2315 PLN becomes 42315), rounding half up with integer arithmetic only.
 */
export function convertGroszeToForeignMinorUnits(grosze: number, midRateScaled: number): number {
  if (!Number.isSafeInteger(grosze) || grosze < 0) {
    throw new RangeError('Amount must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(midRateScaled) || midRateScaled <= 0) {
    throw new RangeError('Rate must be a positive safe integer');
  }
  return Math.floor((grosze * RATE_SCALE * 2 + midRateScaled) / (midRateScaled * 2));
}

/** Formats a mid rate stored scaled by 10 000 as `4,2315`. */
export function formatScaledRate(midRateScaled: number): string {
  const whole = Math.trunc(midRateScaled / RATE_SCALE);
  const fraction = String(midRateScaled % RATE_SCALE).padStart(4, '0');
  return `${whole},${fraction}`;
}
