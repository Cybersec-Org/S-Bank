import { NotImplementedYet } from '@/shared/api/not-implemented';

import type { PaymentsRepository } from './payments.repository';

const PAYMENTS_BACKLOG_ID = 'B-23';

export function createHttpPaymentsRepository(): PaymentsRepository {
  return {
    getPaymentRequest: () => Promise.reject(new NotImplementedYet(PAYMENTS_BACKLOG_ID)),
    approvePaymentRequest: () => Promise.reject(new NotImplementedYet(PAYMENTS_BACKLOG_ID)),
    rejectPaymentRequest: () => Promise.reject(new NotImplementedYet(PAYMENTS_BACKLOG_ID)),
  };
}
