import type { Account, Transaction } from '@/features/accounts';
import { parseAmountToGrosze } from '@/shared/lib/money';

// B-24: switch to the generated schema types once the employee endpoints exist.
export interface CustomerSummary {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
}

export interface CustomerDetails {
  readonly customer: CustomerSummary;
  readonly accounts: readonly Account[];
  readonly transactions: readonly Transaction[];
}

/** UX mirror of the permitted range for an employee-set daily limit; the API enforces the real one. */
export const MIN_DAILY_LIMIT_GROSZE = 100_000;
export const MAX_DAILY_LIMIT_GROSZE = 2_000_000;
export const MIN_SEARCH_LENGTH = 2;

/** Parses the limit field; null when it is not an amount inside the allowed range. */
export function parseDailyLimit(input: string): number | null {
  const grosze = parseAmountToGrosze(input);
  if (grosze === null || grosze < MIN_DAILY_LIMIT_GROSZE || grosze > MAX_DAILY_LIMIT_GROSZE) {
    return null;
  }
  return grosze;
}

export function isSearchLongEnough(query: string): boolean {
  return query.trim().length >= MIN_SEARCH_LENGTH;
}
