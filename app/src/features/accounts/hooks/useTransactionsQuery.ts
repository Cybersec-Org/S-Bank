import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '@/shared/api/RepositoriesProvider';
import { SENSITIVE_QUERY_OPTIONS } from '@/shared/api/query-options';

import type { TransactionQuery } from '../model/account';
import { accountsKeys } from '../model/query-keys';

/** Pass `accountId = null` while the account is not known yet; the query stays disabled. */
export function useTransactionsQuery(accountId: string | null, query: TransactionQuery) {
  const { accounts } = useRepositories();
  return useQuery({
    queryKey: accountsKeys.transactions(accountId ?? 'none', query),
    queryFn: () => {
      if (accountId === null) {
        return Promise.resolve([]);
      }
      return accounts.listTransactions(accountId, query);
    },
    enabled: accountId !== null,
    ...SENSITIVE_QUERY_OPTIONS,
  });
}
