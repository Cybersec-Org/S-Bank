export type PaymentRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

// B-23: switch to the generated schema type once the payment request endpoints exist.
export interface PaymentRequest {
  readonly id: string;
  readonly partnerName: string;
  readonly amountGrosze: number;
  readonly title: string;
  readonly expiresAt: string;
  readonly status: PaymentRequestStatus;
}

export interface PaymentReceipt {
  readonly reference: string;
}
