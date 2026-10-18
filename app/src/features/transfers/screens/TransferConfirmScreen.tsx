import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';

import { describeProblem } from '@/shared/api/problem';
import { useSession } from '@/shared/auth/SessionProvider';
import { useIsMockMode } from '@/shared/config/ApiModeProvider';
import { pl } from '@/shared/i18n/pl';
import { createIdempotencyKey } from '@/shared/lib/idempotency';
import { isUuid } from '@/shared/lib/ids';
import { formatIban } from '@/shared/lib/iban';
import { formatMoney } from '@/shared/lib/money';
import {
  AsyncBoundary,
  Banner,
  Box,
  Button,
  Card,
  EmptyState,
  ErrorState,
  MoneyText,
  Screen,
  Text,
} from '@/shared/ui';

import {
  useCancelTransferMutation,
  useConfirmTransferMutation,
} from '../hooks/useTransferMutations';
import { useTransferDraftQuery } from '../hooks/useTransferDraftQuery';
import type { TransferDraft, TransferReceipt } from '../model/transfer';

type Outcome =
  | { readonly kind: 'reviewing' }
  | { readonly kind: 'done'; readonly receipt: TransferReceipt; readonly draft: TransferDraft }
  | { readonly kind: 'cancelled' };

function SummaryRow({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <Box gap="xs">
      <Text variant="label" tone="muted">
        {label}
      </Text>
      {children}
    </Box>
  );
}

/** FR-05 / SR-03: shows the server-side draft, explains step-up when needed and confirms by draft id. */
export function TransferConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ draftId?: string | string[] }>();
  const draftId = typeof params.draftId === 'string' ? params.draftId : null;
  const session = useSession();
  const isMock = useIsMockMode();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'reviewing' });
  const draftQuery = useTransferDraftQuery(draftId, outcome.kind === 'reviewing');
  const confirm = useConfirmTransferMutation();
  const cancel = useCancelTransferMutation();
  const idempotencyKey = useRef<string | null>(null);

  const draft = draftQuery.data;

  function goToDashboard(): void {
    router.replace('/dashboard');
  }

  if (!isUuid(draftId)) {
    return (
      <Screen title={pl.transferConfirm.title}>
        <ErrorState message={pl.transferConfirm.invalidLink} />
        <Button label={pl.transferConfirm.done} onPress={goToDashboard} variant="secondary" />
      </Screen>
    );
  }

  if (outcome.kind === 'done') {
    return (
      <Screen title={pl.transferConfirm.title}>
        <Banner tone="success" title={pl.transferConfirm.successTitle}>
          {pl.transferConfirm.successMessage(
            formatMoney(outcome.draft.amountGrosze),
            outcome.draft.recipientName,
          )}
        </Banner>
        <Text>{pl.transferConfirm.successReference(outcome.receipt.reference)}</Text>
        <Button label={pl.transferConfirm.done} onPress={goToDashboard} />
      </Screen>
    );
  }

  if (outcome.kind === 'cancelled') {
    return (
      <Screen title={pl.transferConfirm.title}>
        <EmptyState
          title={pl.transferConfirm.cancelledTitle}
          message={pl.transferConfirm.cancelledMessage}
          actionLabel={pl.transferConfirm.done}
          onAction={goToDashboard}
        />
      </Screen>
    );
  }

  const stepUpSatisfied = draft === undefined || !draft.requiresStepUp || session.acr === '2';

  function handleConfirm(): void {
    if (draft === undefined) {
      return;
    }
    // The same key is reused when the user retries after an error, so the bank can detect a duplicate.
    idempotencyKey.current ??= createIdempotencyKey();
    confirm.mutate(
      { draftId: draft.id, idempotencyKey: idempotencyKey.current },
      { onSuccess: (receipt) => setOutcome({ kind: 'done', receipt, draft }) },
    );
  }

  function handleCancel(): void {
    if (draft === undefined) {
      return;
    }
    cancel.mutate(draft.id, { onSuccess: () => setOutcome({ kind: 'cancelled' }) });
  }

  return (
    <Screen title={pl.transferConfirm.title}>
      <AsyncBoundary
        isLoading={draftQuery.isPending}
        error={draftQuery.error}
        isEmpty={draft === undefined}
        onRetry={() => void draftQuery.refetch()}
      >
        {draft === undefined ? null : (
          <Box gap="lg">
            <Card gap="md">
              <Text variant="heading">{pl.transferConfirm.summaryHeading}</Text>
              <SummaryRow label={pl.transferConfirm.fromLabel}>
                <Text>{draft.sourceAccountName}</Text>
              </SummaryRow>
              <SummaryRow label={pl.transferConfirm.toLabel}>
                <Text>{draft.recipientName}</Text>
              </SummaryRow>
              <SummaryRow label={pl.transferConfirm.ibanLabel}>
                {/* The full number is shown on purpose: the user must verify the recipient before confirming. */}
                <Text tabular>{formatIban(draft.recipientIban)}</Text>
              </SummaryRow>
              <SummaryRow label={pl.transferConfirm.titleLabel}>
                <Text>{draft.title}</Text>
              </SummaryRow>
              <SummaryRow label={pl.transferConfirm.amountLabel}>
                <MoneyText grosze={draft.amountGrosze} variant="heading" />
              </SummaryRow>
            </Card>

            <Box gap="md">
              {draft.requiresStepUp ? (
                <Banner tone="warning" title={pl.transferConfirm.stepUpHeading}>
                  {stepUpSatisfied ? pl.transferConfirm.stepUpDone : pl.transferConfirm.stepUpBody}
                </Banner>
              ) : null}
              {draft.requiresStepUp && !stepUpSatisfied && isMock ? (
                <Button
                  label={pl.transferConfirm.stepUpMockButton}
                  variant="secondary"
                  onPress={session.raiseMockAssurance}
                />
              ) : null}
              {confirm.error === null ? null : (
                <Banner tone="danger">{describeProblem(confirm.error)}</Banner>
              )}
              <Button
                label={
                  confirm.isPending ? pl.transferConfirm.confirming : pl.transferConfirm.confirm
                }
                onPress={handleConfirm}
                loading={confirm.isPending}
                disabled={!stepUpSatisfied}
                fullWidth
              />
              <Button
                label={pl.transferConfirm.cancel}
                onPress={handleCancel}
                variant="secondary"
                disabled={confirm.isPending || cancel.isPending}
                fullWidth
              />
            </Box>
          </Box>
        )}
      </AsyncBoundary>
    </Screen>
  );
}
