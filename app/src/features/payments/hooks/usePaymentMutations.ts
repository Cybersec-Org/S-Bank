import { useMutation, useQueryClient } from '@tanstack/react-query';

import { accountsKeys } from '@/features/accounts';
import { useRepositories } from '@/shared/api/RepositoriesProvider';

export function useApprovePaymentMutation() {
  const { payments } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { readonly requestId: string; readonly idempotencyKey: string }) =>
      payments.approvePaymentRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsKeys.all }),
  });
}

export function useRejectPaymentMutation() {
  const { payments } = useRepositories();
  return useMutation({
    mutationFn: (requestId: string) => payments.rejectPaymentRequest(requestId),
  });
}
