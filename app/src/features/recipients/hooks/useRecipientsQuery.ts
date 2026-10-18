import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '@/shared/api/RepositoriesProvider';
import { SENSITIVE_QUERY_OPTIONS } from '@/shared/api/query-options';

import { recipientsKeys } from '../model/query-keys';

export function useRecipientsQuery() {
  const { recipients } = useRepositories();
  return useQuery({
    queryKey: recipientsKeys.list(),
    queryFn: () => recipients.listRecipients(),
    ...SENSITIVE_QUERY_OPTIONS,
  });
}
