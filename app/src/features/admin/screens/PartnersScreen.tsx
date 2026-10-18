import { pl } from '@/shared/i18n/pl';
import { AsyncBoundary, Box, ListItem, Screen, Text } from '@/shared/ui';

import { usePartnersQuery } from '../hooks/useAdmin';

/** FR-12: registered partner API clients and their certificates (read-only mock). */
export function PartnersScreen() {
  const partnersQuery = usePartnersQuery();
  const partners = partnersQuery.data ?? [];
  return (
    <Screen width="wide">
      <AsyncBoundary
        isLoading={partnersQuery.isPending}
        error={partnersQuery.error}
        isEmpty={partners.length === 0}
        onRetry={() => void partnersQuery.refetch()}
        emptyTitle={pl.admin.partnersEmptyTitle}
        emptyMessage={pl.admin.partnersEmptyMessage}
      >
        <Box>
          {partners.map((partner) => {
            const status =
              partner.status === 'active' ? pl.admin.partnerActive : pl.admin.partnerSuspended;
            return (
              <ListItem
                key={partner.id}
                title={partner.name}
                subtitle={pl.admin.partnerCertificate(partner.certificateThumbprint)}
                trailing={<Text variant="label">{status}</Text>}
                accessibilityLabel={`${partner.name}, ${status}, ${pl.admin.partnerCertificate(partner.certificateThumbprint)}`}
              />
            );
          })}
        </Box>
      </AsyncBoundary>
    </Screen>
  );
}
