import { useMemo, useState } from 'react';

import { pl } from '@/shared/i18n/pl';
import { useGoBack } from '@/shared/navigation/useGoBack';
import { AsyncBoundary, Box, ChoiceGroup, Screen, Text, TextField } from '@/shared/ui';

import { TransactionList } from '../components/TransactionList';
import { useAccountsQuery } from '../hooks/useAccountsQuery';
import { useTransactionsQuery } from '../hooks/useTransactionsQuery';
import { resolveHistoryFilter, type HistoryFilterInput } from '../model/history-filter';

const CATEGORY_OPTIONS = [
  { value: 'all', label: pl.history.typeAll },
  { value: 'incoming', label: pl.history.typeIncoming },
  { value: 'outgoing', label: pl.history.typeOutgoing },
  { value: 'payments', label: pl.history.typePayments },
] as const;

/** FR-04: history of one account, filtered by date range and kind. */
export function HistoryScreen() {
  const goBack = useGoBack('/dashboard');
  const accountsQuery = useAccountsQuery();
  const accounts = accountsQuery.data ?? [];
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilterInput>({ from: '', to: '', category: 'all' });

  const activeAccountId = selectedAccountId ?? accounts[0]?.id ?? null;
  const { query, errors } = useMemo(() => resolveHistoryFilter(filter), [filter]);
  const transactionsQuery = useTransactionsQuery(activeAccountId, query);
  const transactions = transactionsQuery.data ?? [];

  return (
    <Screen title={pl.history.title} onBack={goBack} backLabel={pl.history.backLabel}>
      {accounts.length > 1 && activeAccountId !== null ? (
        <ChoiceGroup
          label={pl.transfer.sourceLabel}
          value={activeAccountId}
          onChange={setSelectedAccountId}
          options={accounts.map((account) => ({ value: account.id, label: account.name }))}
        />
      ) : null}

      <Box gap="md">
        <Text variant="heading">{pl.history.filtersHeading}</Text>
        <TextField
          label={pl.history.fromLabel}
          hint={pl.history.dateHint}
          value={filter.from}
          onChangeText={(from) => setFilter((current) => ({ ...current, from }))}
          error={errors.includes('invalidFrom') ? pl.history.dateInvalid : undefined}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        <TextField
          label={pl.history.toLabel}
          hint={pl.history.dateHint}
          value={filter.to}
          onChangeText={(to) => setFilter((current) => ({ ...current, to }))}
          error={
            errors.includes('invalidTo')
              ? pl.history.dateInvalid
              : errors.includes('invalidRange')
                ? pl.history.rangeInvalid
                : undefined
          }
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        <ChoiceGroup
          label={pl.history.typeLabel}
          value={filter.category}
          options={CATEGORY_OPTIONS}
          onChange={(category) => setFilter((current) => ({ ...current, category }))}
        />
      </Box>

      <AsyncBoundary
        isLoading={
          accountsQuery.isPending || (activeAccountId !== null && transactionsQuery.isPending)
        }
        error={accountsQuery.error ?? transactionsQuery.error}
        isEmpty={transactions.length === 0}
        onRetry={() => {
          void accountsQuery.refetch();
          void transactionsQuery.refetch();
        }}
        emptyTitle={pl.history.emptyTitle}
        emptyMessage={pl.history.emptyMessage}
      >
        <TransactionList transactions={transactions} />
      </AsyncBoundary>
    </Screen>
  );
}
