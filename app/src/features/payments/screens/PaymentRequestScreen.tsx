import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { maskIban } from '@/shared/lib/iban';
import { useAccountsQuery } from '@/features/accounts';
import { describeProblem, isNotFoundProblem } from '@/shared/api/problem';
import { useSession } from '@/shared/auth/SessionProvider';
import { useIsMockMode } from '@/shared/config/ApiModeProvider';
import { useNow } from '@/shared/config/ClockProvider';
import { pl } from '@/shared/i18n/pl';
import { isExpired } from '@/shared/lib/dates';
import { createIdempotencyKey } from '@/shared/lib/idempotency';
import { isUuid } from '@/shared/lib/ids';
import { formatMoney } from '@/shared/lib/money';
import { amountRequiresStepUp } from '@/shared/lib/step-up';
import {
  Banner,
  Box,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  MoneyText,
  Screen,
  StepUpPanel,
  Text,
  useTheme,
} from '@/shared/ui';

import { useApprovePaymentMutation, useRejectPaymentMutation } from '../hooks/usePaymentMutations';
import { usePaymentRequestQuery } from '../hooks/usePaymentRequestQuery';
import type { PaymentRequest } from '../model/payment-request';

const COUNTDOWN_TICK_MS = 15_000;
const MS_PER_MINUTE = 60_000;

type Outcome =
  | { readonly kind: 'reviewing' }
  | { readonly kind: 'approved'; readonly request: PaymentRequest }
  | { readonly kind: 'rejected' };

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.lg }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
        <Text variant="listTitle" align="right">
          {value}
        </Text>
      </View>
    </View>
  );
}

function expiryLabel(expiresAtIso: string, now: Date): string {
  const minutes = Math.round((new Date(expiresAtIso).getTime() - now.getTime()) / MS_PER_MINUTE);
  return minutes < 1 ? pl.payment.expiresInLessThanMinute : pl.payment.expiresIn(minutes);
}

/** FR-07 / SR-12: opened by a link or QR code that carried only the id; everything shown comes from the API. */
export function PaymentRequestScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{
    requestId?: string | string[];
    source?: string | string[];
  }>();
  const requestId = typeof params.requestId === 'string' ? params.requestId : null;
  // Display only: how the request was opened. It never influences the amount or the recipient.
  const openedFromQr = params.source === 'qr';
  const session = useSession();
  const isMock = useIsMockMode();
  const now = useNow(COUNTDOWN_TICK_MS);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'reviewing' });
  const requestQuery = usePaymentRequestQuery(requestId, outcome.kind === 'reviewing');
  const accountsQuery = useAccountsQuery();
  const approve = useApprovePaymentMutation();
  const reject = useRejectPaymentMutation();
  const idempotencyKey = useRef<string | null>(null);
  const request = requestQuery.data;
  const account = accountsQuery.data?.[0];

  function goToDashboard(): void {
    router.replace('/dashboard');
  }

  const screenProps = {
    title: pl.payment.title,
    onBack: goToDashboard,
    backLabel: pl.payment.backLabel,
  } as const;

  if (!isUuid(requestId)) {
    return (
      <Screen {...screenProps}>
        <ErrorState message={pl.payment.invalidLink} />
        <Button label={pl.payment.done} onPress={goToDashboard} variant="secondary" fullWidth />
      </Screen>
    );
  }

  if (outcome.kind === 'approved') {
    return (
      <Screen title={pl.payment.title}>
        <Banner tone="success" title={pl.payment.approvedTitle}>
          {pl.payment.approvedMessage(
            formatMoney(outcome.request.amountGrosze),
            outcome.request.partnerName,
          )}
        </Banner>
        <Button label={pl.payment.done} size="large" onPress={goToDashboard} fullWidth />
      </Screen>
    );
  }

  if (outcome.kind === 'rejected') {
    return (
      <Screen title={pl.payment.title}>
        <Banner tone="info" title={pl.payment.rejectedTitle}>
          {pl.payment.rejectedMessage}
        </Banner>
        <Button label={pl.payment.done} size="large" onPress={goToDashboard} fullWidth />
      </Screen>
    );
  }

  function handleApprove(current: PaymentRequest, stepUpPending: boolean): void {
    if (stepUpPending) {
      session.raiseMockAssurance();
    }
    idempotencyKey.current ??= createIdempotencyKey();
    approve.mutate(
      { requestId: current.id, idempotencyKey: idempotencyKey.current },
      { onSuccess: () => setOutcome({ kind: 'approved', request: current }) },
    );
  }

  function renderBody() {
    if (requestQuery.isPending) {
      return <LoadingState />;
    }
    if (requestQuery.error !== null) {
      return isNotFoundProblem(requestQuery.error) ? (
        <EmptyState
          title={pl.payment.notFoundTitle}
          message={pl.payment.notFoundMessage}
          actionLabel={pl.payment.done}
          onAction={goToDashboard}
        />
      ) : (
        <ErrorState
          message={describeProblem(requestQuery.error)}
          onRetry={() => void requestQuery.refetch()}
        />
      );
    }
    if (request === undefined) {
      return null;
    }
    // The server decides; the clock only lets the screen react the moment the countdown reaches zero.
    const expired = request.status === 'expired' || isExpired(request.expiresAt, now);
    const decidable = request.status === 'pending' && !expired;
    const requiresStepUp = amountRequiresStepUp(request.amountGrosze);
    const stepUpPending = requiresStepUp && session.acr !== '2';
    const canStepUp = isMock || !stepUpPending;
    return (
      <Box gap="lg">
        <Box direction="row" wrap gap="sm">
          <Chip
            tone="soft"
            icon="qr"
            label={openedFromQr ? pl.payment.openedFromQr : pl.payment.openedFromLink}
          />
          {decidable ? (
            <Chip tone="outlined" icon="clock" label={expiryLabel(request.expiresAt, now)} />
          ) : null}
        </Box>

        <Card gap="md" radius="large" padding="xl">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <View
              style={{
                width: theme.minTouchTarget + theme.spacing.sm,
                height: theme.minTouchTarget + theme.spacing.sm,
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="store" color={theme.colors.primary} size={26} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="heading">{request.partnerName}</Text>
              <Text variant="caption" tone="muted">
                {pl.payment.partnerBadge}
              </Text>
            </View>
          </View>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="label" tone="muted">
              {pl.payment.amountLabel}
            </Text>
            <MoneyText grosze={request.amountGrosze} variant="amountPay" />
          </View>
          <Row label={pl.payment.titleRow} value={request.title} />
          {account === undefined ? null : (
            <Row
              label={pl.payment.fromRow}
              value={pl.transferConfirm.fromValue(account.name, maskIban(account.iban))}
            />
          )}
        </Card>

        {expired && request.status !== 'approved' && request.status !== 'rejected' ? (
          <Banner tone="warning">{pl.payment.statusExpired}</Banner>
        ) : null}
        {request.status === 'approved' ? <Banner>{pl.payment.statusApproved}</Banner> : null}
        {request.status === 'rejected' ? <Banner>{pl.payment.statusRejected}</Banner> : null}
        {decidable ? <Banner tone="info">{pl.payment.notice}</Banner> : null}
        {decidable && requiresStepUp ? (
          <StepUpPanel title={pl.payment.stepUpHeading}>
            {canStepUp ? pl.payment.stepUpBody : pl.payment.stepUpUnavailable}
          </StepUpPanel>
        ) : null}
        {approve.error === null ? null : (
          <Banner tone="danger">{describeProblem(approve.error)}</Banner>
        )}

        {decidable ? (
          <Box gap="sm">
            <Button
              label={
                approve.isPending
                  ? pl.payment.approving
                  : requiresStepUp
                    ? pl.payment.payWithPasskey
                    : pl.payment.pay(formatMoney(request.amountGrosze))
              }
              icon={requiresStepUp ? 'key' : undefined}
              size="large"
              onPress={() => handleApprove(request, stepUpPending)}
              loading={approve.isPending}
              disabled={!canStepUp}
              fullWidth
            />
            <Button
              label={pl.payment.reject}
              variant="secondary"
              size="large"
              disabled={approve.isPending || reject.isPending}
              onPress={() =>
                reject.mutate(request.id, { onSuccess: () => setOutcome({ kind: 'rejected' }) })
              }
              fullWidth
            />
          </Box>
        ) : (
          <Button
            label={pl.payment.done}
            variant="secondary"
            size="large"
            onPress={goToDashboard}
            fullWidth
          />
        )}
      </Box>
    );
  }

  return <Screen {...screenProps}>{renderBody()}</Screen>;
}
