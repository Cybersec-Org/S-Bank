import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRepositories } from '@/shared/api/RepositoriesProvider';
import { SENSITIVE_QUERY_OPTIONS } from '@/shared/api/query-options';
import { isUuid } from '@/shared/lib/ids';

import { isSearchLongEnough } from '../model/customer';
import { employeeKeys } from '../model/query-keys';

export function useCustomerSearchQuery(submittedQuery: string) {
  const { employee } = useRepositories();
  const query = submittedQuery.trim();
  return useQuery({
    queryKey: employeeKeys.search(query),
    queryFn: () => employee.searchCustomers(query),
    enabled: isSearchLongEnough(query),
    ...SENSITIVE_QUERY_OPTIONS,
  });
}

/** The customer id comes from the URL; its shape is validated before the API is called. */
export function useCustomerDetailsQuery(customerId: unknown) {
  const { employee } = useRepositories();
  const validId = isUuid(customerId) ? customerId : null;
  return useQuery({
    queryKey: employeeKeys.details(validId ?? 'invalid'),
    queryFn: () => {
      if (validId === null) {
        return Promise.reject(new Error('Invalid customer id'));
      }
      return employee.getCustomerDetails(validId);
    },
    enabled: validId !== null,
    retry: false,
    ...SENSITIVE_QUERY_OPTIONS,
  });
}

export function useSetDailyLimitMutation(customerId: string) {
  const { employee } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { readonly accountId: string; readonly limitGrosze: number }) =>
      employee.setDailyLimit(input.accountId, input.limitGrosze),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeeKeys.details(customerId) }),
  });
}

export function useSetAccountBlockedMutation(customerId: string) {
  const { employee } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { readonly accountId: string; readonly blocked: boolean }) =>
      employee.setAccountBlocked(input.accountId, input.blocked),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeeKeys.details(customerId) }),
  });
}
