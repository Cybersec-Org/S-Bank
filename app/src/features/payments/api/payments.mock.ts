import { ApiProblem } from '@/shared/api/problem';
import type { LedgerPort } from '@/shared/api/mock/ledger-port';
import { mockUuid } from '@/shared/api/mock/mock-data';
import {
  createMockRunner,
  resolveMockOptions,
  type MockOptions,
} from '@/shared/api/mock/mock-runner';

import type { PaymentRequest } from '../model/payment-request';
import type { PaymentsRepository } from './payments.repository';

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE = 422;

/** Ids that exist in the demo; anything else is unknown, exactly like a foreign or invented id. */
export const MOCK_PENDING_PAYMENT_REQUEST_ID = mockUuid(901);
export const MOCK_EXPIRED_PAYMENT_REQUEST_ID = mockUuid(902);

function initialRequests(): PaymentRequest[] {
  return [
    {
      id: MOCK_PENDING_PAYMENT_REQUEST_ID,
      partnerName: 'Sklep Demonstracyjny',
      amountGrosze: 8_990,
      title: 'Zamówienie nr 2026/10/0042',
      expiresAt: '2026-10-15T09:30:00.000Z',
      status: 'pending',
    },
    {
      id: MOCK_EXPIRED_PAYMENT_REQUEST_ID,
      partnerName: 'Kawiarnia Testowa',
      amountGrosze: 1_850,
      title: 'Rachunek stolik 7',
      expiresAt: '2026-10-14T18:00:00.000Z',
      status: 'expired',
    },
  ];
}

export function createMockPaymentsRepository(
  ledger: LedgerPort,
  partialOptions?: Partial<MockOptions>,
): PaymentsRepository {
  const runner = createMockRunner(resolveMockOptions(partialOptions));
  let requests = initialRequests();

  function requireRequest(requestId: string): PaymentRequest {
    const found = requests.find((candidate) => candidate.id === requestId);
    if (found === undefined) {
      throw new ApiProblem({ status: HTTP_NOT_FOUND });
    }
    return found;
  }

  function setStatus(requestId: string, status: PaymentRequest['status']): void {
    requests = requests.map((candidate) =>
      candidate.id === requestId ? { ...candidate, status } : candidate,
    );
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
