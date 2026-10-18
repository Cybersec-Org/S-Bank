import type { PaymentReceipt, PaymentRequest } from '../model/payment-request';

export interface ApprovePaymentInput {
  readonly requestId: string;
  readonly idempotencyKey: string;
}

export interface PaymentsRepository {
  /** Details come from the server by id; the link or QR code never carries amounts. */
  getPaymentRequest: (requestId: string) => Promise<PaymentRequest>;
  approvePaymentRequest: (input: ApprovePaymentInput) => Promise<PaymentReceipt>;
  rejectPaymentRequest: (requestId: string) => Promise<void>;
}
