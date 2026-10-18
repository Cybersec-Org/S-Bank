const LOCALE = 'pl-PL';
const BANK_TIME_ZONE = 'Europe/Warsaw';
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: BANK_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: BANK_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** True for a real calendar date in `YYYY-MM-DD` form (rejects `2026-02-31`). */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) {
    return false;
  }
  const [, year = '', month = '', day = ''] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() === Number(month) - 1 &&
    parsed.getUTCDate() === Number(day)
  );
}

/** `15.10.2026` in the bank's time zone. */
export function formatDate(isoTimestamp: string): string {
  return dateFormat.format(new Date(isoTimestamp));
}

/** `15.10.2026, 11:30` in the bank's time zone. */
export function formatDateTime(isoTimestamp: string): string {
  return dateTimeFormat.format(new Date(isoTimestamp));
}

const dayPartsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: BANK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar day (`YYYY-MM-DD`) of a timestamp in the bank's time zone, for range filters. */
export function toBankDay(isoTimestamp: string): string {
  const parts = dayPartsFormat.formatToParts(new Date(isoTimestamp));
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

export function isExpired(expiresAtIso: string, now: Date): boolean {
  return new Date(expiresAtIso).getTime() <= now.getTime();
}
