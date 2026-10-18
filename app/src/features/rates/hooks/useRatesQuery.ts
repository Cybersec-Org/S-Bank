import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '@/shared/api/RepositoriesProvider';

import { ratesKeys } from '../model/query-keys';

/** Public, non-sensitive data, so the default cache lifetime applies. */
export function useRatesQuery() {
  const { rates } = useRepositories();
  return useQuery({
    queryKey: ratesKeys.table(),
    queryFn: () => rates.getRatesTable(),
  });
}
