import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRepositories } from '@/shared/api/RepositoriesProvider';

import { settingsKeys } from '../model/query-keys';

export function useSecuritySettingsQuery() {
  const { settings } = useRepositories();
  return useQuery({
    queryKey: settingsKeys.security(),
    queryFn: () => settings.getSecuritySettings(),
  });
}

export function useSetBiometricsMutation() {
  const { settings } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => settings.setBiometricsEnabled(enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.security() }),
  });
}

export function usePasskeysQuery() {
  const { settings } = useRepositories();
  return useQuery({
    queryKey: settingsKeys.passkeys(),
    queryFn: () => settings.listPasskeys(),
  });
}

export function useAddPasskeyMutation() {
  const { settings } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => settings.addPasskey(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.passkeys() }),
  });
}

export function useRemovePasskeyMutation() {
  const { settings } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (passkeyId: string) => settings.removePasskey(passkeyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.passkeys() }),
  });
}
