import { useRouter } from 'expo-router';
import { useState } from 'react';

import { calculateRemainingDailyLimit, useAccountsQuery, type Account } from '@/features/accounts';
import { useRecipientsQuery } from '@/features/recipients';
import { describeProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { formatIban, formatIbanInput, maskIban } from '@/shared/lib/iban';
import { formatMoney, formatWholeMoney } from '@/shared/lib/money';
import { useGoBack } from '@/shared/navigation/useGoBack';
import {
  AmountField,
  AsyncBoundary,
  Banner,
  Box,
  Button,
  Card,
  ChoiceGroup,
  ProgressBar,
  Screen,
  Text,
  TextField,
} from '@/shared/ui';

import { useCreateTransferDraftMutation } from '../hooks/useTransferMutations';
import { TRANSFER_ERROR_MESSAGES } from '../model/error-messages';
import { amountRequiresStepUp } from '../model/transfer';
import {
  validateTransferForm,
  type SourceAccountContext,
  type TransferFormInput,
} from '../model/transfer-form';

const MANUAL_RECIPIENT = 'manual';
const PERCENT = 100;

function toSourceContext(account: Account | undefined): SourceAccountContext | null {
  if (account === undefined) {
    return null;
  }
  return {
    balanceGrosze: account.balanceGrosze,
    remainingDailyLimitGrosze: calculateRemainingDailyLimit(account),
    blocked: account.status === 'blocked',
  };
}

/** FR-05: collects the transfer, saves a draft on the server and continues to the confirmation by id only. */
export function TransferFormScreen() {
  const router = useRouter();
  const goBack = useGoBack('/dashboard');
  const accountsQuery = useAccountsQuery();
  const recipientsQuery = useRecipientsQuery();
  const createDraft = useCreateTransferDraftMutation();
  const accounts = accountsQuery.data ?? [];
  const recipients = recipientsQuery.data ?? [];

  const [accountId, setAccountId] = useState<string | null>(null);
  const [recipientChoice, setRecipientChoice] = useState<string>(MANUAL_RECIPIENT);
  const [form, setForm] = useState<Omit<TransferFormInput, 'sourceAccountId'>>({
    recipientName: '',
    iban: '',
    amount: '',
    title: '',
  });
  const [showErrors, setShowErrors] = useState(false);

  const activeAccount = accounts.find((account) => account.id === accountId) ?? accounts[0];
  const result = validateTransferForm(
    { ...form, sourceAccountId: activeAccount?.id ?? '' },
    toSourceContext(activeAccount),
  );
  const errors = showErrors ? result.errors : {};
  const showStepUpNotice =
    result.amountGrosze !== null && amountRequiresStepUp(result.amountGrosze);
  const usedAfterGrosze =
    activeAccount === undefined ? 0 : activeAccount.dailyUsedGrosze + (result.amountGrosze ?? 0);
  const limitGrosze = activeAccount?.dailyLimitGrosze ?? 0;
  const limitPercent =
    limitGrosze <= 0
      ? PERCENT
      : Math.min(PERCENT, Math.round((usedAfterGrosze * PERCENT) / limitGrosze));

  function chooseRecipient(choice: string): void {
    setRecipientChoice(choice);
    const saved = recipients.find((recipient) => recipient.id === choice);
    if (saved !== undefined) {
      setForm((current) => ({
        ...current,
        recipientName: saved.name,
        iban: formatIban(saved.iban),
      }));
    }
  }

  function handleSubmit(): void {
    setShowErrors(true);
    if (result.draftInput === null) {
      return;
    }
    createDraft.mutate(result.draftInput, {
      onSuccess: (draft) =>
        router.push({ pathname: '/transfer/[draftId]', params: { draftId: draft.id } }),
    });
  }

  return (
    <Screen title={pl.transfer.title} onBack={goBack} backLabel={pl.transfer.backLabel}>
      <AsyncBoundary
        isLoading={accountsQuery.isPending}
        error={accountsQuery.error}
        isEmpty={accounts.length === 0}
        onRetry={() => void accountsQuery.refetch()}
        emptyTitle={pl.transfer.noAccountsTitle}
        emptyMessage={pl.transfer.noAccountsMessage}
      >
        <Box gap="lg">
          {activeAccount === undefined ? null : (
            <Box gap="sm">
              {accounts.length > 1 ? (
                <ChoiceGroup
                  label={pl.transfer.sourceLabel}
                  value={activeAccount.id}
                  onChange={setAccountId}
                  options={accounts.map((account) => ({ value: account.id, label: account.name }))}
                />
              ) : null}
              <Card gap="xs">
                <Text variant="label" tone="muted">
                  {pl.transfer.sourceLabel}
                </Text>
                <Text variant="listTitle">
                  {pl.transfer.sourceSummary(activeAccount.name, maskIban(activeAccount.iban))}
                </Text>
                <Text variant="caption" tone="muted">
                  {pl.transfer.availableBalance(formatMoney(activeAccount.balanceGrosze))}
                </Text>
              </Card>
              {errors.account === undefined ? null : (
                <Banner tone="danger">{TRANSFER_ERROR_MESSAGES[errors.account]}</Banner>
              )}
            </Box>
          )}

          {recipients.length > 0 ? (
            <ChoiceGroup
              label={pl.transfer.recipientLabel}
              value={recipientChoice}
              onChange={chooseRecipient}
              options={[
                { value: MANUAL_RECIPIENT, label: pl.transfer.recipientNone },
                ...recipients.map((recipient) => ({ value: recipient.id, label: recipient.name })),
              ]}
            />
          ) : null}

          <TextField
            label={pl.transfer.recipientNameLabel}
            placeholder={pl.transfer.recipientNamePlaceholder}
            value={form.recipientName}
            onChangeText={(recipientName) => setForm((current) => ({ ...current, recipientName }))}
            error={errors.recipientName && TRANSFER_ERROR_MESSAGES[errors.recipientName]}
            autoCapitalize="words"
          />
          <TextField
            label={pl.transfer.ibanLabel}
            hint={pl.transfer.ibanHint}
            placeholder={pl.transfer.ibanPlaceholder}
            value={form.iban}
            onChangeText={(iban) =>
              setForm((current) => ({ ...current, iban: formatIbanInput(iban) }))
            }
            error={errors.iban && TRANSFER_ERROR_MESSAGES[errors.iban]}
            keyboardType="number-pad"
            autoCapitalize="characters"
          />
          <AmountField
            label={pl.transfer.amountLabel}
            placeholder={pl.transfer.amountPlaceholder}
            value={form.amount}
            onChangeText={(amount) => setForm((current) => ({ ...current, amount }))}
            error={errors.amount && TRANSFER_ERROR_MESSAGES[errors.amount]}
          />
          <TextField
            label={pl.transfer.titleLabel}
            placeholder={pl.transfer.titlePlaceholder}
            value={form.title}
            onChangeText={(title) => setForm((current) => ({ ...current, title }))}
            error={errors.title && TRANSFER_ERROR_MESSAGES[errors.title]}
            maxLength={140}
          />

          {showStepUpNotice ? (
            <Banner tone="warning" icon="key" title={pl.transfer.stepUpNoticeTitle}>
              {pl.transfer.stepUpNoticeBody}
            </Banner>
          ) : null}

          {activeAccount === undefined ? null : (
            <Box gap="sm">
              <Box direction="row" justify="space-between" gap="md">
                <Text variant="label" tone="muted">
                  {pl.transfer.limitAfterLabel}
                </Text>
                <Text variant="label" tabular>
                  {pl.transfer.limitAfterValue(
                    formatWholeMoney(usedAfterGrosze),
                    formatWholeMoney(limitGrosze),
                  )}
                </Text>
              </Box>
              <ProgressBar percent={limitPercent} label={pl.transfer.limitBarLabel(limitPercent)} />
            </Box>
          )}
          {createDraft.error === null ? null : (
            <Banner tone="danger">{describeProblem(createDraft.error)}</Banner>
          )}

          <Button
            label={createDraft.isPending ? pl.transfer.submitting : pl.transfer.submit}
            onPress={handleSubmit}
            loading={createDraft.isPending}
            size="large"
            fullWidth
          />
        </Box>
      </AsyncBoundary>
    </Screen>
  );
}
