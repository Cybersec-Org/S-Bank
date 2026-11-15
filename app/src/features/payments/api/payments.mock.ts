import { ApiProblem } from '@/shared/api/problem';
import type { LedgerPort } from '@/shared/api/mock/ledger-port';
import { mockUuid } from '@/shared/api/mock/mock-data';
import {
  createMockRunner,
  resolveMockOptions,
  type MockOptions,
} from '@/shared/api/mock/mock-runner';

import { DEMO_PAYMENT_REQUEST_ID, type PaymentRequest } from '../model/payment-request';
import type { PaymentsRepository } from './payments.repository';

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE = 422;

/** Ids that exist in the demo; anything else is unknown, exactly like a foreign or invented id. */
export const MOCK_PENDING_PAYMENT_REQUEST_ID = DEMO_PAYMENT_REQUEST_ID;
export const MOCK_EXPIRED_PAYMENT_REQUEST_ID = mockUuid(902);

const PENDING_VALID_FOR_MS = 14 * 60 * 1000;
const EXPIRED_AGO_MS = 60 * 60 * 1000;

/**
 * The demo request is always 14 minutes from expiry when it is read, so the live counter can be shown
 * at any time; the real API fixes the expiry when the partner creates the request.
 */
function requestsAt(now: Date): PaymentRequest[] {
  return [
    {
      id: MOCK_PENDING_PAYMENT_REQUEST_ID,
      partnerName: 'Sklep Rowerowy Szprycha',
      amountGrosze: 24_900,
      title: 'Zamówienie nr 1042',
      expiresAt: new Date(now.getTime() + PENDING_VALID_FOR_MS).toISOString(),
      status: 'pending',
    },
    {
      id: MOCK_EXPIRED_PAYMENT_REQUEST_ID,
      partnerName: 'Kawiarnia Testowa',
      amountGrosze: 1_850,
      title: 'Rachunek stolik 7',
      expiresAt: new Date(now.getTime() - EXPIRED_AGO_MS).toISOString(),
      status: 'expired',
    },
  ];
}

export function createMockPaymentsRepository(
  ledger: LedgerPort,
  partialOptions?: Partial<MockOptions>,
): PaymentsRepository {
  const options = resolveMockOptions(partialOptions);
  const runner = createMockRunner(options);
  // Decisions made in this session (approved / rejected) win over the freshly generated requests.
  const decided = new Map<string, PaymentRequest['status']>();

  function requireRequest(requestId: string): PaymentRequest {
    const found = requestsAt(options.now()).find((candidate) => candidate.id === requestId);
    if (found === undefined) {
      throw new ApiProblem({ status: HTTP_NOT_FOUND });
    }
    return { ...found, status: decided.get(requestId) ?? found.status };
  }

  function setStatus(requestId: string, status: PaymentRequest['status']): void {
    decided.set(requestId, status);
  }

  return {
    getPaymentRequest: (requestId) => runner.run(() => requireRequest(requestId)),
    approvePaymentRequest: ({ requestId }) =>
      runner.run(() => {
        const request = requireRequest(requestId);
        if (request.status === 'expired') {
          throw new ApiProblem({ status: HTTP_UNPROCESSABLE, code: 'request_expired' });
        }
        const accountId = ledger.primaryAccountId();
        const snapshot = accountId === null ? null : ledger.getAccountSnapshot(accountId);
        if (accountId === null || snapshot === null) {
          throw new ApiProblem({ status: HTTP_NOT_FOUND });
        }
        if (snapshot.blocked) {
          throw new ApiProblem({ status: HTTP_FORBIDDEN, code: 'account_blocked' });
        }
        if (request.amountGrosze > snapshot.balanceGrosze) {
          throw new ApiProblem({ status: HTTP_UNPROCESSABLE, code: 'insufficient_funds' });
        }
        if (request.amountGrosze > snapshot.remainingDailyLimitGrosze) {
          throw new ApiProblem({ status: HTTP_UNPROCESSABLE, code: 'daily_limit_exceeded' });
        }
        const reference = ledger.recordOutgoing({
          accountId,
          kind: 'link_payment',
          amountGrosze: request.amountGrosze,
          title: request.title,
          counterpartyName: request.partnerName,
        });
        setStatus(requestId, 'approved');
        return { reference };
      }),
    rejectPaymentRequest: (requestId) =>
      runner.run(() => {
        requireRequest(requestId);
        setStatus(requestId, 'rejected');
      }),
  };
}
