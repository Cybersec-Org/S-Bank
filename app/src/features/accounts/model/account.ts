import { toBankDay } from '@/shared/lib/dates';

export type AccountStatus = 'active' | 'blocked';

// B-12: switch to the generated schema type once GET /api/accounts exists.
export interface Account {
  readonly id: string;
  readonly name: string;
  readonly iban: string;
  readonly balanceGrosze: number;
  readonly dailyLimitGrosze: number;
  readonly dailyUsedGrosze: number;
  readonly status: AccountStatus;
}

export type TransactionDirection = 'incoming' | 'outgoing';

/** How the operation came about; payments are the ones started from a QR code or a link. */
export type TransactionKind = 'transfer' | 'qr_payment' | 'link_payment';

// B-12: switch to the generated schema type once the transactions endpoint exists.
export interface Transaction {
  readonly id: string;
  readonly accountId: string;
  readonly direction: TransactionDirection;
  readonly kind: TransactionKind;
  /** Always positive; the direction says whether money came in or went out. */
  readonly amountGrosze: number;
  readonly title: string;
  readonly counterpartyName: string;
  readonly bookedAt: string;
}

export interface TransactionQuery {
  /** Inclusive first day, `YYYY-MM-DD`. */
  readonly from: string | null;
  /** Inclusive last day, `YYYY-MM-DD`. */
  readonly to: string | null;
  readonly direction: TransactionDirection | null;
  /** Only operations that started from a QR code or a payment link. */
  readonly paymentsOnly: boolean;
  readonly limit: number | null;
}

export const ALL_TRANSACTIONS: TransactionQuery = {
  from: null,
  to: null,
  direction: null,
  paymentsOnly: false,
  limit: null,
};

const PERCENT = 100;

/** Mirror of the server rule, for display only; the API decides what is allowed. */
export function calculateRemainingDailyLimit(account: Account): number {
  return Math.max(0, account.dailyLimitGrosze - account.dailyUsedGrosze);
}

export function calculateLimitUsagePercent(account: Account): number {
  if (account.dailyLimitGrosze <= 0) {
    return PERCENT;
  }
  return Math.min(
    PERCENT,
    Math.round((account.dailyUsedGrosze * PERCENT) / account.dailyLimitGrosze),
  );
}

export function isPaymentKind(kind: TransactionKind): boolean {
  return kind === 'qr_payment' || kind === 'link_payment';
}

/** Amount with sign as shown in lists: outgoing operations are negative. */
export function signedAmountGrosze(transaction: Transaction): number {
  return transaction.direction === 'outgoing'
    ? -transaction.amountGrosze
    : transaction.amountGrosze;
}

function matchesQuery(transaction: Transaction, query: TransactionQuery): boolean {
  const day = toBankDay(transaction.bookedAt);
  return (
    (query.from === null || day >= query.from) &&
    (query.to === null || day <= query.to) &&
    (query.direction === null || transaction.direction === query.direction) &&
    (!query.paymentsOnly || isPaymentKind(transaction.kind))
  );
}

/** Filters, sorts newest first and limits; used where the data source cannot filter by itself. */
export function applyTransactionQuery(
  transactions: readonly Transaction[],
  query: TransactionQuery,
): readonly Transaction[] {
  const matching = transactions
    .filter((transaction) => matchesQuery(transaction, query))
    .sort((left, right) => right.bookedAt.localeCompare(left.bookedAt));
  return query.limit === null ? matching : matching.slice(0, query.limit);
}
