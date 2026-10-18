import type { Account, Transaction, TransactionQuery } from '../model/account';

export interface AccountsRepository {
  listAccounts: () => Promise<readonly Account[]>;
  listTransactions: (accountId: string, query: TransactionQuery) => Promise<readonly Transaction[]>;
}
