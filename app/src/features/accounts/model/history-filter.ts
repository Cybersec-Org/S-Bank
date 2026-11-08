import { isIsoDate } from '@/shared/lib/dates';

import { ALL_TRANSACTIONS, type TransactionQuery } from './account';

/** The filter chips of the history screen: everything, incoming, outgoing or payments only. */
export type HistoryCategory = 'all' | 'incoming' | 'outgoing' | 'payments';

export type HistoryFilterError = 'invalidFrom' | 'invalidTo' | 'invalidRange';

export interface HistoryFilterInput {
  readonly from: string;
  readonly to: string;
  readonly category: HistoryCategory;
}

export interface HistoryFilterResult {
  readonly query: TransactionQuery;
  readonly errors: readonly HistoryFilterError[];
}

/** Turns the raw form values into the query sent to the API, reporting what is wrong instead of sending it. */
export function resolveHistoryFilter(input: HistoryFilterInput): HistoryFilterResult {
  const errors: HistoryFilterError[] = [];
  const from = input.from.trim();
  const to = input.to.trim();

  const fromValid = from !== '' && isIsoDate(from);
  const toValid = to !== '' && isIsoDate(to);
  if (from !== '' && !fromValid) {
    errors.push('invalidFrom');
  }
  if (to !== '' && !toValid) {
    errors.push('invalidTo');
  }
  const rangeInvalid = fromValid && toValid && from > to;
  if (rangeInvalid) {
    errors.push('invalidRange');
  }

  return {
    errors,
    query: {
      ...ALL_TRANSACTIONS,
      from: fromValid && !rangeInvalid ? from : null,
      to: toValid && !rangeInvalid ? to : null,
      direction:
        input.category === 'incoming' || input.category === 'outgoing' ? input.category : null,
      paymentsOnly: input.category === 'payments',
    },
  };
}
