import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '@/shared/api/RepositoriesProvider';
import { SENSITIVE_QUERY_OPTIONS } from '@/shared/api/query-options';

import { adminKeys } from '../model/query-keys';

export function useUsersQuery() {
  const { admin } = useRepositories();
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: () => admin.listUsers(),
    ...SENSITIVE_QUERY_OPTIONS,
  });
}

export function usePartnersQuery() {
  const { admin } = useRepositories();
  return useQuery({
    queryKey: adminKeys.partners(),
    queryFn: () => admin.listPartners(),
    ...SENSITIVE_QUERY_OPTIONS,
  });
}

export function useAuditQuery() {
  const { admin } = useRepositories();
  return useQuery({
    queryKey: adminKeys.audit(),
    queryFn: () => admin.listAuditEntries(),
    ...SENSITIVE_QUERY_OPTIONS,
  });
}
