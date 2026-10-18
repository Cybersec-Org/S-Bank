import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '@/shared/api/RepositoriesProvider';
import { SENSITIVE_QUERY_OPTIONS } from '@/shared/api/query-options';
import { isUuid } from '@/shared/lib/ids';

import { transfersKeys } from '../model/query-keys';

/**
 * The draft id comes from the URL, so its shape is checked before any request is made. Pass
 * `enabled = false` once the draft is confirmed or cancelled so it is not fetched again.
 */
export function useTransferDraftQuery(draftId: unknown, enabled = true) {
  const { transfers } = useRepositories();
  const validId = isUuid(draftId) ? draftId : null;
  const queryKey = transfersKeys.draft(validId ?? 'invalid');

  return useQuery({
    queryKey,
    queryFn: () => {
      if (validId === null) {
        return Promise.reject(new Error('Invalid draft id'));
      }
      return transfers.getDraft(validId);
    },
    enabled: enabled && validId !== null,
    retry: false,
    ...SENSITIVE_QUERY_OPTIONS,
  });
}
