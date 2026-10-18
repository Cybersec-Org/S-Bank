import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '@/shared/api/RepositoriesProvider';
import { SENSITIVE_QUERY_OPTIONS } from '@/shared/api/query-options';
import { isUuid } from '@/shared/lib/ids';

import { paymentsKeys } from '../model/query-keys';

/** The request id arrives via deep link or QR code: validate its shape, then fetch every detail from the API. */
export function usePaymentRequestQuery(requestId: unknown, enabled = true) {
  const { payments } = useRepositories();
  const validId = isUuid(requestId) ? requestId : null;
  const queryKey = paymentsKeys.request(validId ?? 'invalid');

  return useQuery({
    queryKey,
    queryFn: () => {
      if (validId === null) {
        return Promise.reject(new Error('Invalid payment request id'));
      }
      return payments.getPaymentRequest(validId);
    },
    enabled: enabled && validId !== null,
    retry: false,
    ...SENSITIVE_QUERY_OPTIONS,
  });
}
