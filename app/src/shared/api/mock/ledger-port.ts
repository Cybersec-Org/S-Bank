export interface LedgerAccountSnapshot {
  readonly name: string;
  readonly balanceGrosze: number;
  readonly remainingDailyLimitGrosze: number;
  readonly blocked: boolean;
}

export interface OutgoingEntry {
  readonly accountId: string;
  readonly amountGrosze: number;
  readonly title: string;
  readonly counterpartyName: string;
}

/**
 * Lets the mock transfer and payment repositories debit the mock accounts, so a confirmed transfer is
 * visible on the dashboard. Mock mode only; the real API does this inside one database transaction.
 */
export interface LedgerPort {
  primaryAccountId: () => string | null;
  getAccountSnapshot: (accountId: string) => LedgerAccountSnapshot | null;
  /** Debits the account and appends a transaction; returns the operation reference. */
  recordOutgoing: (entry: OutgoingEntry) => string;
}
