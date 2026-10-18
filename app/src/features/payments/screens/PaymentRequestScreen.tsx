import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';

import { describeProblem, isNotFoundProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { formatDateTime } from '@/shared/lib/dates';
import { createIdempotencyKey } from '@/shared/lib/idempotency';
import { isUuid } from '@/shared/lib/ids';
import { formatMoney } from '@/shared/lib/money';
import {
  Banner,
  Box,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  MoneyText,
  Screen,
  Text,
} from '@/shared/ui';

import { useApprovePaymentMutation, useRejectPaymentMutation } from '../hooks/usePaymentMutations';
import { usePaymentRequestQuery } from '../hooks/usePaymentRequestQuery';
import type { PaymentRequest } from '../model/payment-request';

type Outcome =
  | { readonly kind: 'reviewing' }
  | { readonly kind: 'approved'; readonly request: PaymentRequest }
  | { readonly kind: 'rejected' };

/** FR-07 / SR-12: opened by a link or QR code that carried only the id; everything shown comes from the API. */
export function PaymentRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId?: string | string[] }>();
  const requestId = typeof params.requestId === 'string' ? params.requestId : null;
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'reviewing' });
  const requestQuery = usePaymentRequestQuery(requestId, outcome.kind === 'reviewing');
  const approve = useApprovePaymentMutation();
  const reject = useRejectPaymentMutation();
  const idempotencyKey = useRef<string | null>(null);
  const request = requestQuery.data;

  function goToDashboard(): void {
    router.replace('/dashboard');
  }

  if (!isUuid(requestId)) {
    return (
      <Screen title={pl.payment.title}>
        <ErrorState message={pl.payment.invalidLink} />
        <Button label={pl.payment.done} onPress={goToDashboard} variant="secondary" />
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
        <Button label={pl.payment.done} onPress={goToDashboard} />
      </Screen>
    );
  }

  if (outcome.kind === 'rejected') {
    return (
      <Screen title={pl.payment.title}>
        <Banner tone="info" title={pl.payment.rejectedTitle}>
          {pl.payment.rejectedMessage}
        </Banner>
        <Button label={pl.payment.done} onPress={goToDashboard} />
      </Screen>
    );
  }

  function handleApprove(current: PaymentRequest): void {
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
    const decidable = request.status === 'pending';
    return (
      <Box gap="lg">
        <Card gap="md">
          <Box gap="xs">
            <Text variant="label" tone="muted">
              {pl.payment.partnerLabel}
            </Text>
            <Text variant="heading">{request.partnerName}</Text>
          </Box>
          <Box gap="xs">
            <Text variant="label" tone="muted">
              {pl.payment.amountLabel}
            </Text>
            <MoneyText grosze={request.amountGrosze} variant="money" />
          </Box>
          <Box gap="xs">
            <Text variant="label" tone="muted">
              {pl.payment.titleLabel}
            </Text>
            <Text>{request.title}</Text>
          </Box>
          <Box gap="xs">
            <Text variant="label" tone="muted">
              {pl.payment.expiresLabel}
            </Text>
            <Text>{formatDateTime(request.expiresAt)}</Text>
          </Box>
        </Card>

        {request.status === 'expired' ? (
          <Banner tone="warning">{pl.payment.statusExpired}</Banner>
        ) : null}
        {request.status === 'approved' ? <Banner>{pl.payment.statusApproved}</Banner> : null}
        {request.status === 'rejected' ? <Banner>{pl.payment.statusRejected}</Banner> : null}
        {decidable ? <Banner tone="info">{pl.payment.notice}</Banner> : null}
        {approve.error === null ? null : (
          <Banner tone="danger">{describeProblem(approve.error)}</Banner>
        )}

        {decidable ? (
          <Box gap="sm">
            <Button
              label={approve.isPending ? pl.payment.approving : pl.payment.approve}
              onPress={() => handleApprove(request)}
              loading={approve.isPending}
              fullWidth
            />
            <Button
              label={pl.payment.reject}
              variant="secondary"
              disabled={approve.isPending || reject.isPending}
              onPress={() =>
                reject.mutate(request.id, { onSuccess: () => setOutcome({ kind: 'rejected' }) })
              }
              fullWidth
            />
          </Box>
        ) : null}
      </Box>
    );
  }

  return <Screen title={pl.payment.title}>{renderBody()}</Screen>;
}
