import { useLocalSearchParams } from 'expo-router';

import { AccountCard, TransactionList } from '@/features/accounts';
import { describeProblem, isNotFoundProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { isUuid } from '@/shared/lib/ids';
import {
  Banner,
  Box,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  Text,
} from '@/shared/ui';

import { DailyLimitForm } from '../components/DailyLimitForm';
import {
  useCustomerDetailsQuery,
  useSetAccountBlockedMutation,
  useSetDailyLimitMutation,
} from '../hooks/useEmployee';

/**
 * FR-09 / T-09: read-only view of a customer. There is deliberately no transfer action; the only
 * writes are the daily limit and blocking, both enforced and audited by the API.
 */
export function CustomerDetailsScreen() {
  const params = useLocalSearchParams<{ customerId?: string | string[] }>();
  const customerId = typeof params.customerId === 'string' ? params.customerId : null;
  const detailsQuery = useCustomerDetailsQuery(customerId);
  const setLimit = useSetDailyLimitMutation(customerId ?? 'invalid');
  const setBlocked = useSetAccountBlockedMutation(customerId ?? 'invalid');
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
    return (
      <Box gap="lg">
        <Text variant="heading">{details.customer.displayName}</Text>
        <Text tone="muted">{details.customer.email}</Text>

        <Box gap="md">
          <Text variant="heading">{pl.employee.accountsHeading}</Text>
          {details.accounts.map((account) => (
            <Box key={account.id} gap="md">
              <AccountCard account={account} />
              <Card gap="md">
                <Text variant="label">
                  {account.status === 'blocked' ? pl.employee.blocked : pl.employee.active}
                </Text>
                <DailyLimitForm
                  currentLimitGrosze={account.dailyLimitGrosze}
                  pending={setLimit.isPending}
                  onSave={(limitGrosze) => setLimit.mutate({ accountId: account.id, limitGrosze })}
                />
                {setLimit.isSuccess ? (
                  <Banner tone="success">{pl.employee.limitSaved}</Banner>
                ) : null}
                <Button
                  label={account.status === 'blocked' ? pl.employee.unblock : pl.employee.block}
                  variant={account.status === 'blocked' ? 'secondary' : 'destructive'}
                  loading={setBlocked.isPending}
                  onPress={() =>
                    setBlocked.mutate({
                      accountId: account.id,
                      blocked: account.status !== 'blocked',
                    })
                  }
                />
              </Card>
            </Box>
          ))}
        </Box>
        {actionError === null ? null : (
          <Banner tone="danger">{describeProblem(actionError)}</Banner>
        )}

        <Box gap="sm">
          <Text variant="heading">{pl.employee.historyHeading}</Text>
          {details.transactions.length === 0 ? (
            <Text tone="muted">{pl.employee.historyEmpty}</Text>
          ) : (
            <TransactionList transactions={details.transactions} />
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Screen width="wide">
      <Banner tone="info" title={pl.employee.readOnlyBannerTitle}>
        {pl.employee.readOnlyBanner}
      </Banner>
      {renderBody()}
    </Screen>
  );
}
