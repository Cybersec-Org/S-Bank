import { pl } from '@/shared/i18n/pl';
import { formatDate } from '@/shared/lib/dates';
import { formatScaledRate } from '@/shared/lib/money';
import { AsyncBoundary, Box, Card, ListItem, Screen, Text } from '@/shared/ui';

import { CurrencyConverter } from '../components/CurrencyConverter';
import { useRatesQuery } from '../hooks/useRatesQuery';

/** FR-08: NBP table A mid rates and a converter; available without signing in. */
export function RatesScreen() {
  const ratesQuery = useRatesQuery();
  const table = ratesQuery.data;
  const rates = table?.rates ?? [];

  return (
    <Screen>
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
            <Card gap="xs">
              <Text variant="heading">{pl.rates.source}</Text>
              <Text tone="muted">{pl.rates.effectiveDate(formatDate(table.effectiveDate))}</Text>
              <Text variant="caption" tone="muted">
                {table.tableNumber}
              </Text>
            </Card>
            <Box>
              <Box direction="row" justify="space-between">
                <Text variant="label" tone="muted">
                  {pl.rates.columnCurrency}
                </Text>
                <Text variant="label" tone="muted">
                  {pl.rates.columnRate}
                </Text>
              </Box>
              {rates.map((rate) => (
                <ListItem
                  key={rate.code}
                  title={rate.code}
                  subtitle={rate.name}
                  trailing={<Text tabular>{formatScaledRate(rate.midRateScaled)}</Text>}
                  accessibilityLabel={pl.rates.rowLabel(
                    rate.code,
                    rate.name,
                    formatScaledRate(rate.midRateScaled),
                  )}
                />
              ))}
            </Box>
            <CurrencyConverter rates={rates} />
          </Box>
        )}
      </AsyncBoundary>
    </Screen>
  );
}
