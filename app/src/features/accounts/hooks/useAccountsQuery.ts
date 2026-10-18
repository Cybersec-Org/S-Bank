import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '@/shared/api/RepositoriesProvider';
import { SENSITIVE_QUERY_OPTIONS } from '@/shared/api/query-options';

import { accountsKeys } from '../model/query-keys';

export function useAccountsQuery() {
  const { accounts } = useRepositories();
  return useQuery({
    queryKey: accountsKeys.list(),
    queryFn: () => accounts.listAccounts(),
    ...SENSITIVE_QUERY_OPTIONS,
  });
}
