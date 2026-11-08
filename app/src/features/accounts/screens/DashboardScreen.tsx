import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { convertPlnToForeign, useRatesQuery, type Rate } from '@/features/rates';
import { DEMO_PAYMENT_REQUEST_ID } from '@/features/payments';
import { useSession } from '@/shared/auth/SessionProvider';
import { useIsMockMode } from '@/shared/config/ApiModeProvider';
import { pl } from '@/shared/i18n/pl';
import { formatMoney } from '@/shared/lib/money';
import { AsyncBoundary, Box, Button, Icon, Screen, Text, useTheme } from '@/shared/ui';

import { AccountCard } from '../components/AccountCard';
import { ShortcutTile } from '../components/ShortcutTile';
import { TransactionList } from '../components/TransactionList';
import { useAccountsQuery } from '../hooks/useAccountsQuery';
import { useTransactionsQuery } from '../hooks/useTransactionsQuery';
import { ALL_TRANSACTIONS } from '../model/account';

const RECENT_OPERATIONS_COUNT = 4;
const RECENT_QUERY = { ...ALL_TRANSACTIONS, limit: RECENT_OPERATIONS_COUNT } as const;
const FOREIGN_CURRENCY = 'EUR';

function approxLineFor(balanceGrosze: number, rate: Rate | undefined): string | null {
  if (rate === undefined) {
    return null;
  }
  return pl.dashboard.approxForeign(
    formatMoney(convertPlnToForeign(balanceGrosze, rate), rate.code),
  );
}

/** FR-03: accounts with balance, today's limit, shortcuts and the last operations. */
export function DashboardScreen() {
  const router = useRouter();
  const theme = useTheme();
  const session = useSession();
  const isMock = useIsMockMode();
  const { principal } = session;
  const accountsQuery = useAccountsQuery();
  const ratesQuery = useRatesQuery();
  const accounts = accountsQuery.data ?? [];
  const primaryAccount = accounts[0] ?? null;
  const recentQuery = useTransactionsQuery(primaryAccount?.id ?? null, RECENT_QUERY);
  const recent = recentQuery.data ?? [];
  const foreignRate = ratesQuery.data?.rates.find((rate) => rate.code === FOREIGN_CURRENCY);

  function handleLock(): void {
    session.signOut();
    router.replace('/');
  }

  function handleScan(): void {
    // No camera yet: in demo mode the shortcut opens the demo payment request directly.
    if (isMock) {
      router.push({
        pathname: '/pay/[requestId]',
        params: { requestId: DEMO_PAYMENT_REQUEST_ID, source: 'qr' },
      });
    } else {
      router.push('/scan');
    }
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="greeting" tone="muted">
            {pl.dashboard.greeting}
          </Text>
          {principal === null ? null : (
            <Text variant="userName" accessibilityRole="header">
              {principal.displayName}
            </Text>
          )}
        </View>
        <Pressable
          onPress={handleLock}
          accessibilityRole="button"
          accessibilityLabel={pl.dashboard.lockApp}
          style={({ pressed }) => ({
            width: theme.minTouchTarget,
            height: theme.minTouchTarget,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radii.pill,
            borderWidth: theme.layout.borderWidth,
            borderColor: theme.colors.border,
            backgroundColor: pressed ? theme.colors.neutralChip : theme.colors.surface,
          })}
        >
          <Icon name="lock" color={theme.colors.text} />
        </Pressable>
      </View>

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
            <AccountCard
              key={account.id}
              account={account}
              approxLine={approxLineFor(account.balanceGrosze, foreignRate)}
            />
          ))}
        </Box>
      </AsyncBoundary>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <ShortcutTile
          label={pl.dashboard.shortcutTransfer}
          icon="transfer"
          onPress={() => router.push('/transfer')}
        />
        <ShortcutTile label={pl.dashboard.shortcutScan} icon="qr" onPress={handleScan} />
        <ShortcutTile
          label={pl.dashboard.shortcutRates}
          icon="rates"
          onPress={() => router.push('/currency-rates')}
        />
        <ShortcutTile
          label={pl.dashboard.shortcutAtms}
          icon="atm"
          onPress={() => router.push('/atms')}
        />
      </View>

      {primaryAccount === null ? null : (
        <Box gap="md">
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
            }}
          >
            <Text variant="heading">{pl.dashboard.recentHeading}</Text>
            <Button
              label={pl.dashboard.allHistory}
              variant="link"
              size="small"
              accessibilityRole="link"
              onPress={() => router.push('/history')}
            />
          </View>
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
