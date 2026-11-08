import { View } from 'react-native';

import { Banner, Card, MoneyText, Text, useTheme } from '@/shared/ui';
import { pl } from '@/shared/i18n/pl';
import { ibanEnding, maskIban } from '@/shared/lib/iban';
import { formatWholeMoney } from '@/shared/lib/money';

import type { Account } from '../model/account';

interface AccountCardProps {
  readonly account: Account;
  /** Second line under the balance, for example the balance in euro at the NBP rate. */
  readonly approxLine?: string | null;
}

/** The green balance card of the dashboard: account, masked number, balance and today's limit. */
export function AccountCard({ account, approxLine = null }: AccountCardProps) {
  const theme = useTheme();
  return (
    <Card tone="primary" radius="large" gap="md" padding="xl">
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.spacing.md,
        }}
      >
        <Text variant="listTitle" tone="inverse">
          {pl.dashboard.accountTitle(account.name)}
        </Text>
        <Text
          variant="caption"
          tone="inverseMuted"
          tabular
          accessibilityLabel={pl.dashboard.accountEnding(ibanEnding(account.iban))}
        >
          {maskIban(account.iban)}
        </Text>
      </View>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="label" tone="inverseMuted">
          {pl.dashboard.balanceLabel}
        </Text>
        <MoneyText grosze={account.balanceGrosze} variant="balance" tone="inverse" />
      </View>
      <View style={{ gap: theme.spacing.xs }}>
        {approxLine === null ? null : (
          <Text variant="caption" tone="inverseMuted">
            {approxLine}
          </Text>
        )}
        <Text variant="caption" tone="inverseMuted">
          {pl.dashboard.limitToday(formatWholeMoney(account.dailyLimitGrosze))}
        </Text>
      </View>
      {account.status === 'blocked' ? (
        <Banner tone="danger" title={pl.dashboard.blocked}>
          {pl.errors.accountBlocked}
        </Banner>
      ) : null}
    </Card>
  );
}
