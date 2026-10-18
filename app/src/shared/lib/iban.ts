const POLISH_IBAN_LENGTH = 28;
const POLISH_IBAN_PATTERN = /^PL\d{26}$/;
const MOD_97_DIVISOR = 97;
const IBAN_GROUP_SIZE = 4;
const VISIBLE_TRAILING_CHARACTERS = 4;
const CHAR_CODE_A = 65;
const CHAR_CODE_Z = 90;
const LETTER_VALUE_OFFSET = CHAR_CODE_A - 10; // 'A' must become 10
const MASK_CHARACTER = '•';

/** Removes whitespace and upper-cases, the canonical form stored and sent to the API. */
export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

function toNumericString(rearranged: string): string {
  let numeric = '';
  for (const character of rearranged) {
    const code = character.charCodeAt(0);
    numeric +=
      code >= CHAR_CODE_A && code <= CHAR_CODE_Z ? String(code - LETTER_VALUE_OFFSET) : character;
  }
  return numeric;
}

function remainderModulo97(numeric: string): number {
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % MOD_97_DIVISOR;
  }
  return remainder;
}

/** Validates a Polish IBAN (PL + 26 digits) with the ISO 13616 mod-97 checksum. */
export function isValidPolishIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (iban.length !== POLISH_IBAN_LENGTH || !POLISH_IBAN_PATTERN.test(iban)) {
    return false;
  }
  const rearranged = iban.slice(IBAN_GROUP_SIZE) + iban.slice(0, IBAN_GROUP_SIZE);
  return remainderModulo97(toNumericString(rearranged)) === 1;
}

/** Groups a normalized IBAN in blocks of four for display where the full value is required. */
export function formatIban(input: string): string {
  const iban = normalizeIban(input);
  const groups: string[] = [];
  for (let start = 0; start < iban.length; start += IBAN_GROUP_SIZE) {
    groups.push(iban.slice(start, start + IBAN_GROUP_SIZE));
  }
  return groups.join(' ');
}

/** Masks all but the country code and the last four characters: `PL•• •••• … 0001`. */
export function maskIban(input: string): string {
  const iban = normalizeIban(input);
  if (iban.length <= VISIBLE_TRAILING_CHARACTERS + 2) {
    return MASK_CHARACTER.repeat(iban.length);
  }
  const country = iban.slice(0, 2);
  const tail = iban.slice(-VISIBLE_TRAILING_CHARACTERS);
  const hiddenCount = iban.length - 2 - VISIBLE_TRAILING_CHARACTERS;
  return formatIban(`${country}${MASK_CHARACTER.repeat(hiddenCount)}${tail}`);
}

/** The last four characters, used in accessible labels instead of the whole masked value. */
export function ibanEnding(input: string): string {
  return normalizeIban(input).slice(-VISIBLE_TRAILING_CHARACTERS);
}
