import { pl } from '@/shared/i18n/pl';
import { AsyncBoundary, Box, ListItem, Screen, Text } from '@/shared/ui';

import { useUsersQuery } from '../hooks/useAdmin';

/** FR-12: users and their roles (read-only mock; role changes arrive with B-29). */
export function UsersScreen() {
  const usersQuery = useUsersQuery();
  const users = usersQuery.data ?? [];
  return (
    <Screen width="wide">
      <AsyncBoundary
        isLoading={usersQuery.isPending}
        error={usersQuery.error}
        isEmpty={users.length === 0}
        onRetry={() => void usersQuery.refetch()}
        emptyTitle={pl.admin.usersEmptyTitle}
        emptyMessage={pl.admin.usersEmptyMessage}
      >
        <Box>
          {users.map((user) => {
            const roles = user.roles.map((role) => pl.roles[role]).join(', ');
            return (
              <ListItem
                key={user.id}
                title={user.displayName}
                subtitle={user.email}
                trailing={<Text variant="label">{roles}</Text>}
                accessibilityLabel={pl.admin.userRowLabel(user.displayName, roles)}
              />
            );
          })}
        </Box>
      </AsyncBoundary>
    </Screen>
  );
}
