import { useRouter } from 'expo-router';
import { useState } from 'react';

import { calculateRemainingDailyLimit, useAccountsQuery, type Account } from '@/features/accounts';
import { useRecipientsQuery } from '@/features/recipients';
import { describeProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { formatMoney } from '@/shared/lib/money';
import {
  AsyncBoundary,
  Banner,
  Box,
  Button,
  ChoiceGroup,
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

  function chooseRecipient(choice: string): void {
    setRecipientChoice(choice);
    const saved = recipients.find((recipient) => recipient.id === choice);
    if (saved !== undefined) {
      setForm((current) => ({ ...current, recipientName: saved.name, iban: saved.iban }));
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
    <Screen title={pl.transfer.title}>
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
            <Box gap="xs">
              <ChoiceGroup
                label={pl.transfer.sourceLabel}
                value={activeAccount.id}
                onChange={setAccountId}
                options={accounts.map((account) => ({ value: account.id, label: account.name }))}
              />
              <Text variant="caption" tone="muted">
                {pl.transfer.availableBalance(formatMoney(activeAccount.balanceGrosze))}
              </Text>
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
            value={form.recipientName}
            onChangeText={(recipientName) => setForm((current) => ({ ...current, recipientName }))}
            error={errors.recipientName && TRANSFER_ERROR_MESSAGES[errors.recipientName]}
            autoCapitalize="words"
          />
          <TextField
            label={pl.transfer.ibanLabel}
            hint={pl.transfer.ibanHint}
            value={form.iban}
            onChangeText={(iban) => setForm((current) => ({ ...current, iban }))}
            error={errors.iban && TRANSFER_ERROR_MESSAGES[errors.iban]}
            autoCapitalize="characters"
          />
          <TextField
            label={pl.transfer.amountLabel}
            hint={pl.transfer.amountHint}
            value={form.amount}
            onChangeText={(amount) => setForm((current) => ({ ...current, amount }))}
            error={errors.amount && TRANSFER_ERROR_MESSAGES[errors.amount]}
            keyboardType="decimal-pad"
          />
          <TextField
            label={pl.transfer.titleLabel}
            value={form.title}
            onChangeText={(title) => setForm((current) => ({ ...current, title }))}
            error={errors.title && TRANSFER_ERROR_MESSAGES[errors.title]}
            maxLength={140}
          />

          {showStepUpNotice ? <Banner tone="info">{pl.transfer.stepUpNotice}</Banner> : null}
          {createDraft.error === null ? null : (
            <Banner tone="danger">{describeProblem(createDraft.error)}</Banner>
          )}

          <Button
            label={createDraft.isPending ? pl.transfer.submitting : pl.transfer.submit}
            onPress={handleSubmit}
            loading={createDraft.isPending}
            fullWidth
          />
        </Box>
      </AsyncBoundary>
    </Screen>
  );
}
