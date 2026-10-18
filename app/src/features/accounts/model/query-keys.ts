import type { TransactionQuery } from './account';

export const accountsKeys = {
  all: ['accounts'] as const,
  list: () => [...accountsKeys.all, 'list'] as const,
  transactions: (accountId: string, query: TransactionQuery) =>
    [...accountsKeys.all, 'transactions', accountId, query] as const,
};
