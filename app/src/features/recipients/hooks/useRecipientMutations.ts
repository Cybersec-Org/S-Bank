import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useRepositories } from '@/shared/api/RepositoriesProvider';

import type { RecipientInput } from '../model/recipient';
import { recipientsKeys } from '../model/query-keys';

export function useSaveRecipientMutation() {
  const { recipients } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { readonly id: string | null; readonly input: RecipientInput }) =>
      id === null ? recipients.createRecipient(input) : recipients.updateRecipient(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: recipientsKeys.all }),
  });
}

export function useDeleteRecipientMutation() {
  const { recipients } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recipients.deleteRecipient(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: recipientsKeys.all }),
  });
}
