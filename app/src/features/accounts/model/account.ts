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

// B-12: switch to the generated schema type once the transactions endpoint exists.
export interface Transaction {
  readonly id: string;
  readonly accountId: string;
  readonly direction: TransactionDirection;
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
  readonly limit: number | null;
}

export const ALL_TRANSACTIONS: TransactionQuery = {
  from: null,
  to: null,
  direction: null,
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

/** Amount with sign as shown in lists: outgoing operations are negative. */
export function signedAmountGrosze(transaction: Transaction): number {
  return transaction.direction === 'outgoing'
    ? -transaction.amountGrosze
    : transaction.amountGrosze;
}
