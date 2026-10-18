import { useRouter } from 'expo-router';

import { useSession } from '@/shared/auth/SessionProvider';
import { pl } from '@/shared/i18n/pl';
import { AsyncBoundary, Box, Button, Screen, Text } from '@/shared/ui';

import { AccountCard } from '../components/AccountCard';
import { TransactionList } from '../components/TransactionList';
import { useAccountsQuery } from '../hooks/useAccountsQuery';
import { useTransactionsQuery } from '../hooks/useTransactionsQuery';
import { ALL_TRANSACTIONS } from '../model/account';

const RECENT_OPERATIONS_COUNT = 5;
const RECENT_QUERY = { ...ALL_TRANSACTIONS, limit: RECENT_OPERATIONS_COUNT } as const;

/** FR-03: accounts with balance, daily limit usage and the last operations. */
export function DashboardScreen() {
  const router = useRouter();
  const { principal } = useSession();
  const accountsQuery = useAccountsQuery();
  const accounts = accountsQuery.data ?? [];
  const primaryAccount = accounts[0] ?? null;
  const recentQuery = useTransactionsQuery(primaryAccount?.id ?? null, RECENT_QUERY);
  const recent = recentQuery.data ?? [];

  return (
    <Screen title={pl.dashboard.title}>
      {principal === null ? null : (
        <Text variant="heading">{pl.dashboard.greeting(principal.displayName)}</Text>
      )}
      <AsyncBoundary
        isLoading={accountsQuery.isPending}
        error={accountsQuery.error}
        isEmpty={accounts.length === 0}
        onRetry={() => void accountsQuery.refetch()}
        emptyTitle={pl.dashboard.emptyAccountsTitle}
        emptyMessage={pl.dashboard.emptyAccountsMessage}
      >
        <Box gap="lg">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </Box>
      </AsyncBoundary>

      <Box gap="sm">
        <Text variant="heading">{pl.dashboard.shortcutsHeading}</Text>
        <Box direction="row" wrap gap="sm">
          <Button label={pl.dashboard.shortcutTransfer} onPress={() => router.push('/transfer')} />
          <Button
            label={pl.dashboard.shortcutScan}
            variant="secondary"
            onPress={() => router.push('/scan')}
          />
          <Button
            label={pl.dashboard.shortcutRates}
            variant="secondary"
            onPress={() => router.push('/rates')}
          />
          <Button
            label={pl.dashboard.shortcutAtms}
            variant="secondary"
            onPress={() => router.push('/atms')}
          />
          <Button
            label={pl.dashboard.shortcutRecipients}
            variant="secondary"
            onPress={() => router.push('/recipients')}
          />
        </Box>
      </Box>

      {primaryAccount === null ? null : (
        <Box gap="sm">
          <Text variant="heading">{pl.dashboard.recentHeading}</Text>
          <AsyncBoundary
            isLoading={recentQuery.isPending}
            error={recentQuery.error}
            isEmpty={recent.length === 0}
            onRetry={() => void recentQuery.refetch()}
            emptyTitle={pl.dashboard.recentEmptyTitle}
            emptyMessage={pl.dashboard.recentEmptyMessage}
          >
            <TransactionList transactions={recent} />
          </AsyncBoundary>
        </Box>
      )}
    </Screen>
  );
}
