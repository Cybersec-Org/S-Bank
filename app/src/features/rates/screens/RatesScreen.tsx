import { View } from 'react-native';

import { pl } from '@/shared/i18n/pl';
import { formatLongDate } from '@/shared/lib/dates';
import { formatScaledRate } from '@/shared/lib/money';
import {
  AsyncBoundary,
  Box,
  Card,
  Icon,
  ListItem,
  Screen,
  ScreenHeader,
  Text,
  useTheme,
} from '@/shared/ui';

import { CurrencyConverter } from '../components/CurrencyConverter';
import { useRatesQuery } from '../hooks/useRatesQuery';

interface RatesScreenProps {
  /** Starting amount of the converter, for example the signed-in customer's balance. */
  readonly defaultAmountGrosze?: number | null;
  /** Set for guests: shows a back arrow that returns to the login screen. */
  readonly onBack?: () => void;
}

/** FR-08: NBP table A mid rates and a converter; available without signing in. */
export function RatesScreen({ defaultAmountGrosze = null, onBack }: RatesScreenProps) {
  const theme = useTheme();
  const ratesQuery = useRatesQuery();
  const table = ratesQuery.data;
  const rates = table?.rates ?? [];

  return (
    <Screen>
      {onBack === undefined ? null : (
        <ScreenHeader title={pl.rates.title} backLabel={pl.rates.backToLogin} onBack={onBack} />
      )}
      {onBack === undefined ? (
        <Box gap="xs">
          <Text variant="title">{pl.rates.title}</Text>
          {table === undefined ? null : (
            <Text tone="muted">
              {pl.rates.subtitle(table.tableNumber, formatLongDate(table.effectiveDate))}
            </Text>
          )}
        </Box>
      ) : table === undefined ? null : (
        <Text tone="muted">
          {pl.rates.subtitle(table.tableNumber, formatLongDate(table.effectiveDate))}
        </Text>
      )}
      <AsyncBoundary
        isLoading={ratesQuery.isPending}
        error={ratesQuery.error}
        isEmpty={rates.length === 0}
        onRetry={() => void ratesQuery.refetch()}
        emptyTitle={pl.rates.emptyTitle}
        emptyMessage={pl.rates.emptyMessage}
      >
        {table === undefined ? null : (
          <Box gap="lg">
            <CurrencyConverter rates={rates} defaultAmountGrosze={defaultAmountGrosze} />
            <Card padding="none" gap="none">
              {rates.map((rate, index) => (
                <ListItem
                  key={rate.code}
                  title={rate.code}
                  subtitle={rate.name}
                  inset
                  last={index === rates.length - 1}
                  trailing={
                    <Text variant="listTitle" tabular>
                      {pl.rates.rate(formatScaledRate(rate.midRateScaled))}
                    </Text>
                  }
                  accessibilityLabel={pl.rates.rowLabel(
                    rate.code,
                    rate.name,
                    formatScaledRate(rate.midRateScaled),
                  )}
                />
              ))}
            </Card>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
              <Icon name="globe" color={theme.colors.textMuted} size={20} />
              <Text variant="caption" tone="muted">
                {pl.rates.publicNote} <Text variant="label">{pl.rates.publicEndpoint}</Text>
              </Text>
            </View>
          </Box>
        )}
      </AsyncBoundary>
    </Screen>
  );
}
