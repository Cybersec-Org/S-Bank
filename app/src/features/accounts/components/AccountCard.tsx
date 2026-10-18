import { Banner, Box, Card, MoneyText, ProgressBar, Text } from '@/shared/ui';
import { pl } from '@/shared/i18n/pl';
import { ibanEnding, maskIban } from '@/shared/lib/iban';
import { formatMoney } from '@/shared/lib/money';

import {
  calculateLimitUsagePercent,
  calculateRemainingDailyLimit,
  type Account,
} from '../model/account';

interface AccountCardProps {
  readonly account: Account;
}

export function AccountCard({ account }: AccountCardProps) {
  const remaining = calculateRemainingDailyLimit(account);
  return (
    <Card gap="md">
      <Box gap="xs">
        <Text variant="heading">{pl.dashboard.accountTitle(account.name)}</Text>
        <Text
          variant="caption"
          tone="muted"
          accessibilityLabel={pl.dashboard.accountEnding(ibanEnding(account.iban))}
        >
          {maskIban(account.iban)}
        </Text>
      </Box>
      <Box gap="xs">
        <Text variant="label" tone="muted">
          {pl.dashboard.balanceLabel}
        </Text>
        <MoneyText grosze={account.balanceGrosze} variant="money" />
      </Box>
      {account.status === 'blocked' ? (
        <Banner tone="danger" title={pl.dashboard.blocked}>
          {pl.errors.accountBlocked}
        </Banner>
      ) : null}
      <Box gap="xs">
        <Text variant="label">{pl.dashboard.limitHeading}</Text>
        <ProgressBar
          percent={calculateLimitUsagePercent(account)}
          label={pl.dashboard.limitBarLabel}
        />
        <Text variant="caption" tone="muted">
          {pl.dashboard.limitUsage(
            formatMoney(account.dailyUsedGrosze),
            formatMoney(account.dailyLimitGrosze),
          )}
        </Text>
        <Text variant="caption" tone="muted">
          {pl.dashboard.limitRemaining(formatMoney(remaining))}
        </Text>
      </Box>
    </Card>
  );
}
