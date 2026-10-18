import { useState } from 'react';

import { pl } from '@/shared/i18n/pl';
import { AsyncBoundary, Banner, Box, Button, ListItem, Screen, Text } from '@/shared/ui';

import { useAtmsQuery } from '../hooks/useAtmsQuery';
import { formatDistance } from '../model/atm';

type LocationStep = 'idle' | 'explaining' | 'unavailable';

/** FR-13: ATM list. Location is requested only when the user asks for the nearest ones (SR-12). */
export function AtmsScreen() {
  const atmsQuery = useAtmsQuery();
  const [step, setStep] = useState<LocationStep>('idle');
  const atms = atmsQuery.data ?? [];

  return (
    <Screen>
      <Text tone="muted">{pl.atms.intro}</Text>

      {step === 'idle' ? (
        <Button label={pl.atms.nearestButton} onPress={() => setStep('explaining')} />
      ) : null}
      {step === 'explaining' ? (
        <Banner tone="info" title={pl.atms.rationaleTitle}>
          <Box gap="md">
            <Text>{pl.atms.rationaleBody}</Text>
            <Box direction="row" gap="sm" wrap>
              <Button label={pl.atms.rationaleConfirm} onPress={() => setStep('unavailable')} />
              <Button
                label={pl.atms.rationaleDismiss}
                variant="secondary"
                onPress={() => setStep('idle')}
              />
            </Box>
          </Box>
        </Banner>
      ) : null}
      {step === 'unavailable' ? (
        <Banner tone="warning">{pl.atms.locationUnavailable}</Banner>
      ) : null}

      <AsyncBoundary
        isLoading={atmsQuery.isPending}
        error={atmsQuery.error}
        isEmpty={atms.length === 0}
        onRetry={() => void atmsQuery.refetch()}
        emptyTitle={pl.atms.emptyTitle}
        emptyMessage={pl.atms.emptyMessage}
      >
        <Box>
          {atms.map((atm) => (
            <ListItem
              key={atm.id}
              title={atm.name}
              subtitle={atm.address}
              trailing={<Text tabular>{formatDistance(atm.distanceMeters)}</Text>}
              accessibilityLabel={`${atm.name}, ${atm.address}, ${pl.atms.distance(formatDistance(atm.distanceMeters))}`}
            />
          ))}
        </Box>
      </AsyncBoundary>
    </Screen>
  );
}
