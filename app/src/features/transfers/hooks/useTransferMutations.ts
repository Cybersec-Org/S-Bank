import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useRepositories } from '@/shared/api/RepositoriesProvider';
import { accountsKeys } from '@/features/accounts';

import type { CreateTransferDraftInput } from '../model/transfer';

export function useCreateTransferDraftMutation() {
  const { transfers } = useRepositories();
  return useMutation({
    mutationFn: (input: CreateTransferDraftInput) => transfers.createDraft(input),
  });
}

export function useConfirmTransferMutation() {
  const { transfers } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { readonly draftId: string; readonly idempotencyKey: string }) =>
      transfers.confirmDraft(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsKeys.all }),
  });
}

export function useCancelTransferMutation() {
  const { transfers } = useRepositories();
  return useMutation({
    mutationFn: (draftId: string) => transfers.cancelDraft(draftId),
  });
}
