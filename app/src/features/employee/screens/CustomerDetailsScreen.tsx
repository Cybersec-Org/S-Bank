import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  transactionKindLabel,
  signedAmountGrosze,
  type Account,
  type Transaction,
} from '@/features/accounts';
import { describeProblem, isNotFoundProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { formatDate } from '@/shared/lib/dates';
import { maskIban } from '@/shared/lib/iban';
import { isUuid } from '@/shared/lib/ids';
import { formatMoney, formatWholeMoney } from '@/shared/lib/money';
import { useGoBack } from '@/shared/navigation/useGoBack';
import {
  Banner,
  Box,
  Button,
  Card,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  MoneyText,
  Screen,
  Text,
  useTheme,
  type DataTableColumn,
} from '@/shared/ui';

import { BlockDialog, LimitDialog } from '../components/AccountActionDialogs';
import {
  useCustomerDetailsQuery,
  useSetAccountBlockedMutation,
  useSetDailyLimitMutation,
} from '../hooks/useEmployee';

type Dialog =
  | { readonly kind: 'limit'; readonly account: Account }
  | { readonly kind: 'block'; readonly account: Account };

const ACCOUNT_COLUMN_WIDTHS = { account: 200, balance: 150, limit: 150, actions: 360 } as const;
const HISTORY_COLUMN_WIDTHS = { date: 120, description: 260, kind: 200, amount: 140 } as const;

/**
 * FR-09 / T-09: read-only view of a customer. There is deliberately no transfer action; the only
 * writes are the daily limit and blocking, both enforced and audited by the API.
 */
export function CustomerDetailsScreen() {
  const theme = useTheme();
  const goBack = useGoBack('/customers');
  const params = useLocalSearchParams<{ customerId?: string | string[] }>();
  const customerId = typeof params.customerId === 'string' ? params.customerId : null;
  const detailsQuery = useCustomerDetailsQuery(customerId);
  const setLimit = useSetDailyLimitMutation(customerId ?? 'invalid');
  const setBlocked = useSetAccountBlockedMutation(customerId ?? 'invalid');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const details = detailsQuery.data;

  function renderBody() {
    if (!isUuid(customerId)) {
      return <ErrorState message={pl.employee.invalidLink} />;
    }
    if (detailsQuery.isPending) {
      return <LoadingState />;
    }
    if (detailsQuery.error !== null) {
      return isNotFoundProblem(detailsQuery.error) ? (
        <EmptyState title={pl.employee.notFoundTitle} message={pl.employee.notFoundMessage} />
      ) : (
        <ErrorState
          message={describeProblem(detailsQuery.error)}
          onRetry={() => void detailsQuery.refetch()}
        />
      );
    }
    if (details === undefined) {
      return null;
    }
    const actionError = setLimit.error ?? setBlocked.error;
    const anyBlocked = details.accounts.some((account) => account.status === 'blocked');

    const accountColumns: readonly DataTableColumn<Account>[] = [
      {
        key: 'account',
        title: pl.employee.columnAccount,
        width: ACCOUNT_COLUMN_WIDTHS.account,
        render: (account) => (
          <Text variant="listTitle">
            {pl.employee.accountRow(account.name, maskIban(account.iban))}
          </Text>
        ),
      },
      {
        key: 'balance',
        title: pl.employee.columnBalance,
        width: ACCOUNT_COLUMN_WIDTHS.balance,
        render: (account) => (
          <Text variant="listTitle" tabular>
            {formatMoney(account.balanceGrosze)}
          </Text>
        ),
      },
      {
        key: 'limit',
        title: pl.employee.columnLimit,
        width: ACCOUNT_COLUMN_WIDTHS.limit,
        render: (account) => (
          <Text variant="listTitle" tabular>
            {formatWholeMoney(account.dailyLimitGrosze)}
          </Text>
        ),
      },
      {
        key: 'actions',
        title: pl.employee.columnActions,
        width: ACCOUNT_COLUMN_WIDTHS.actions,
        render: (account) => {
          const name = pl.employee.accountRow(account.name, maskIban(account.iban));
          const blocked = account.status === 'blocked';
          return (
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              <Button
                label={pl.employee.limitChange}
                accessibilityLabel={pl.employee.limitChangeLabel(name)}
                variant="secondary"
                size="small"
                onPress={() => setDialog({ kind: 'limit', account })}
              />
              <Button
                label={blocked ? pl.employee.unblock : pl.employee.block}
                accessibilityLabel={
                  blocked ? pl.employee.unblockLabel(name) : pl.employee.blockLabel(name)
                }
                variant={blocked ? 'secondary' : 'destructive'}
                size="small"
                onPress={() => setDialog({ kind: 'block', account })}
              />
            </View>
          );
        },
      },
    ];

    const historyColumns: readonly DataTableColumn<Transaction>[] = [
      {
        key: 'date',
        title: pl.employee.columnDate,
        width: HISTORY_COLUMN_WIDTHS.date,
        render: (transaction) => <Text tabular>{formatDate(transaction.bookedAt)}</Text>,
      },
      {
        key: 'description',
        title: pl.employee.columnDescription,
        width: HISTORY_COLUMN_WIDTHS.description,
        render: (transaction) => <Text variant="listTitle">{transaction.title}</Text>,
      },
      {
        key: 'kind',
        title: pl.employee.columnKind,
        width: HISTORY_COLUMN_WIDTHS.kind,
        render: (transaction) => <Text tone="muted">{transactionKindLabel(transaction)}</Text>,
      },
      {
        key: 'amount',
        title: pl.employee.columnAmount,
        width: HISTORY_COLUMN_WIDTHS.amount,
        align: 'right',
        render: (transaction) => {
          const signed = signedAmountGrosze(transaction);
          return <MoneyText grosze={signed} signed tone={signed < 0 ? 'default' : 'accent'} />;
        },
      },
    ];

    return (
      <Box gap="lg">
        <Banner tone="warning" icon="eye" title={pl.employee.readOnlyBannerTitle}>
          {pl.employee.readOnlyBanner}
        </Banner>

        <Card gap="sm" radius="large">
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
            }}
          >
            <View style={{ gap: theme.spacing.xs }}>
              <Text variant="userName" accessibilityRole="header">
                {details.customer.displayName}
              </Text>
              <Text tone="muted">
                {pl.employee.customerMeta(details.customer.email, details.customer.customerNumber)}
              </Text>
            </View>
            <Chip
              tone={anyBlocked ? 'danger' : 'soft'}
              icon={anyBlocked ? 'lock' : 'check'}
              label={anyBlocked ? pl.employee.statusBlocked : pl.employee.statusActive}
            />
          </View>
        </Card>

        {setLimit.isSuccess ? <Banner tone="success">{pl.employee.limitSaved}</Banner> : null}
        {actionError === null ? null : (
          <Banner tone="danger">{describeProblem(actionError)}</Banner>
        )}

        <Card gap="md">
          <Text variant="heading">{pl.employee.accountsHeading}</Text>
          <DataTable
            label={pl.employee.accountsHeading}
            columns={accountColumns}
            rows={details.accounts}
            rowKey={(account) => account.id}
          />
        </Card>

        <Card gap="md">
          <Text variant="heading">{pl.employee.historyHeading}</Text>
          {details.transactions.length === 0 ? (
            <Text tone="muted">{pl.employee.historyEmpty}</Text>
          ) : (
            <DataTable
              label={pl.employee.historyHeading}
              columns={historyColumns}
              rows={details.transactions}
              rowKey={(transaction) => transaction.id}
            />
          )}
        </Card>

        <LimitDialog
          visible={dialog?.kind === 'limit'}
          currentLimitGrosze={dialog?.account.dailyLimitGrosze ?? 0}
          pending={setLimit.isPending}
          onCancel={() => setDialog(null)}
          onSave={(limitGrosze) => {
            if (dialog?.kind === 'limit') {
              setLimit.mutate(
                { accountId: dialog.account.id, limitGrosze },
                { onSuccess: () => setDialog(null) },
              );
            }
          }}
        />
        <BlockDialog
          visible={dialog?.kind === 'block'}
          blocked={dialog?.account.status === 'blocked'}
          pending={setBlocked.isPending}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            if (dialog?.kind === 'block') {
              setBlocked.mutate(
                { accountId: dialog.account.id, blocked: dialog.account.status !== 'blocked' },
                { onSuccess: () => setDialog(null) },
              );
            }
          }}
        />
      </Box>
    );
  }

  return (
    <Screen width="wide" gutter="gutter">
      <Box direction="row" align="center" gap="md" wrap>
        <Button
          label={pl.employee.backToSearch}
          icon="arrowLeft"
          variant="link"
          size="small"
          onPress={goBack}
        />
      </Box>
      <Text variant="pageTitle" accessibilityRole="header">
        {pl.employee.searchTitle}
      </Text>
      {renderBody()}
    </Screen>
  );
}
