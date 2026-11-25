import { z } from 'zod';

import { plnToGrosze, type HttpTransport } from '@/shared/api/http';

import type { PaymentReceipt, PaymentRequest, PaymentRequestStatus } from '../model/payment-request';
import type { ApprovePaymentInput, PaymentsRepository } from './payments.repository';

const apiPaymentRequestSchema = z.object({
  id: z.string(),
  receiverName: z.string(),
  amount: z.number(),
  title: z.string(),
  status: z.string(),
  createdAt: z.string(),
});

const apiPaymentConfirmSchema = z.object({
  operationNumber: z.string(),
});

function mapStatus(raw: string): PaymentRequestStatus {
  if (raw === 'PAID') {
    return 'approved';
  }
  if (raw === 'REJECTED' || raw === 'CANCELLED') {
    return 'rejected';
  }
  if (raw === 'EXPIRED') {
    return 'expired';
  }
  return 'pending';
}

export function createHttpPaymentsRepository(transport: HttpTransport): PaymentsRepository {
  return {
    async getPaymentRequest(requestId: string): Promise<PaymentRequest> {
      const raw = await transport.requestJson(
        `/payment-requests/${encodeURIComponent(requestId)}`,
        apiPaymentRequestSchema,
      );
      const expiresAt = new Date(new Date(raw.createdAt).getTime() + 15 * 60_000).toISOString();
      return {
        id: raw.id,
        partnerName: raw.receiverName,
        amountGrosze: plnToGrosze(raw.amount),
        title: raw.title,
        expiresAt,
        status: mapStatus(raw.status),
      };
    },
    async approvePaymentRequest(input: ApprovePaymentInput): Promise<PaymentReceipt> {
      const res = await transport.requestJson(
        `/payment-requests/${encodeURIComponent(input.requestId)}/pay`,
        apiPaymentConfirmSchema,
        {
          method: 'POST',
          body: { idempotencyKey: input.idempotencyKey },
        },
      );
      return { reference: res.operationNumber };
    },
    async rejectPaymentRequest() {
      return Promise.resolve();
    },
  };
}
