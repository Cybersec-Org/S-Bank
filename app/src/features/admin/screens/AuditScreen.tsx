import { pl } from '@/shared/i18n/pl';
import { formatDateTime } from '@/shared/lib/dates';
import { AsyncBoundary, Banner, Box, ListItem, Screen } from '@/shared/ui';

import { useAuditQuery } from '../hooks/useAdmin';

/** FR-12 / SR-14: read-only view of the append-only audit log. */
export function AuditScreen() {
  const auditQuery = useAuditQuery();
  const entries = auditQuery.data ?? [];
  return (
    <Screen width="wide">
      <Banner tone="info">{pl.admin.auditReadOnly}</Banner>
      <AsyncBoundary
        isLoading={auditQuery.isPending}
        error={auditQuery.error}
        isEmpty={entries.length === 0}
        onRetry={() => void auditQuery.refetch()}
        emptyTitle={pl.admin.auditEmptyTitle}
        emptyMessage={pl.admin.auditEmptyMessage}
      >
        <Box>
          {entries.map((entry) => {
            const action = pl.admin.auditActions[entry.action];
            const when = formatDateTime(entry.occurredAt);
            return (
              <ListItem
                key={entry.id}
                title={action}
                subtitle={`${entry.actorName} · ${when} · ${pl.admin.auditMeta(entry.ipAddress, entry.acr)}`}
                accessibilityLabel={`${pl.admin.auditRowLabel(action, entry.actorName, when)}, ${pl.admin.auditMeta(entry.ipAddress, entry.acr)}`}
              />
            );
          })}
        </Box>
      </AsyncBoundary>
    </Screen>
  );
}
