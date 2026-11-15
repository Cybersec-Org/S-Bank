import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { useAccountsQuery } from '@/features/accounts';
import { describeProblem } from '@/shared/api/problem';
import { useSession } from '@/shared/auth/SessionProvider';
import { useIsMockMode } from '@/shared/config/ApiModeProvider';
import { pl } from '@/shared/i18n/pl';
import { createIdempotencyKey } from '@/shared/lib/idempotency';
import { isUuid } from '@/shared/lib/ids';
import { formatIban, maskIban } from '@/shared/lib/iban';
import { formatMoney } from '@/shared/lib/money';
import { useGoBack } from '@/shared/navigation/useGoBack';
import {
  AsyncBoundary,
  Banner,
  Box,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  MoneyText,
  Screen,
  StepUpPanel,
  Text,
  useTheme,
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
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.lg }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>{children}</View>
    </View>
  );
}

/** FR-05 / SR-03: shows the server-side draft, explains step-up when needed and confirms by draft id. */
export function TransferConfirmScreen() {
  const router = useRouter();
  const theme = useTheme();
  const goBack = useGoBack('/transfer');
  const params = useLocalSearchParams<{ draftId?: string | string[] }>();
  const draftId = typeof params.draftId === 'string' ? params.draftId : null;
  const session = useSession();
  const isMock = useIsMockMode();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'reviewing' });
  const accountsQuery = useAccountsQuery();
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
      <Screen
        title={pl.transferConfirm.title}
        onBack={goBack}
        backLabel={pl.transferConfirm.backLabel}
      >
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
        <Button label={pl.transferConfirm.done} size="large" onPress={goToDashboard} fullWidth />
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
  // Without the real sign-in (B-10) a passkey confirmation can only be simulated in demo mode.
  const canStepUp = isMock || stepUpSatisfied;
  const sourceAccount = accountsQuery.data?.find(
    (account) => account.id === draft?.sourceAccountId,
  );

  function handleConfirm(): void {
    if (draft === undefined) {
      return;
    }
    if (!stepUpSatisfied) {
      session.raiseMockAssurance();
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
    <Screen
      title={pl.transferConfirm.title}
      onBack={goBack}
      backLabel={pl.transferConfirm.backLabel}
    >
      <AsyncBoundary
        isLoading={draftQuery.isPending}
        error={draftQuery.error}
        isEmpty={draft === undefined}
        onRetry={() => void draftQuery.refetch()}
      >
        {draft === undefined ? null : (
          <Box gap="lg">
            <Card gap="md" radius="large" padding="xl">
              <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
                <Text variant="label" tone="muted">
                  {pl.transferConfirm.amountLabel}
                </Text>
                <MoneyText grosze={draft.amountGrosze} variant="amountConfirm" align="center" />
              </View>
              <View
                style={{ height: theme.layout.borderWidth, backgroundColor: theme.colors.divider }}
              />
              <SummaryRow label={pl.transferConfirm.toLabel}>
                <Text variant="listTitle" align="right">
                  {draft.recipientName}
                </Text>
              </SummaryRow>
              <SummaryRow label={pl.transferConfirm.ibanLabel}>
                {/* The full number is shown on purpose: the user must verify the recipient before confirming. */}
                <Text variant="listTitle" tabular align="right">
                  {formatIban(draft.recipientIban)}
                </Text>
              </SummaryRow>
              <SummaryRow label={pl.transferConfirm.titleLabel}>
                <Text variant="listTitle" align="right">
                  {draft.title}
                </Text>
              </SummaryRow>
              <SummaryRow label={pl.transferConfirm.fromLabel}>
                <Text variant="listTitle" align="right">
                  {sourceAccount === undefined
                    ? draft.sourceAccountName
                    : pl.transferConfirm.fromValue(
                        draft.sourceAccountName,
                        maskIban(sourceAccount.iban),
                      )}
                </Text>
              </SummaryRow>
            </Card>

            {draft.requiresStepUp ? (
              <StepUpPanel title={pl.transferConfirm.stepUpHeading}>
                {canStepUp ? pl.transferConfirm.stepUpBody : pl.transferConfirm.stepUpUnavailable}
              </StepUpPanel>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Icon name="file" color={theme.colors.textMuted} size={22} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="caption" tone="muted">
                  {pl.transferConfirm.signedNote}
                </Text>
              </View>
            </View>

            <Box gap="sm">
              {confirm.error === null ? null : (
                <Banner tone="danger">{describeProblem(confirm.error)}</Banner>
              )}
              <Button
                label={
                  confirm.isPending
                    ? pl.transferConfirm.confirming
                    : draft.requiresStepUp
                      ? pl.transferConfirm.confirmWithPasskey
                      : pl.transferConfirm.confirm
                }
                icon={draft.requiresStepUp ? 'key' : undefined}
                size="large"
                onPress={handleConfirm}
                loading={confirm.isPending}
                disabled={!canStepUp}
                fullWidth
              />
              <Button
                label={pl.transferConfirm.cancel}
                onPress={handleCancel}
                variant="ghost"
                size="large"
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
