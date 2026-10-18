import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '@/shared/api/RepositoriesProvider';

import { sortByDistance } from '../model/atm';
import { atmsKeys } from '../model/query-keys';

export function useAtmsQuery() {
  const { atms } = useRepositories();
  return useQuery({
    queryKey: atmsKeys.list(),
    queryFn: () => atms.listAtms(),
    select: sortByDistance,
  });
}
