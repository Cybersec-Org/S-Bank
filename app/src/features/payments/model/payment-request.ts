/**
 * Id of the demo payment request. In mock mode "Skanuj QR" opens it directly (there is no camera yet);
 * it has the shape of a real request id and is only an identifier: the details come from the data source.
 */
export const DEMO_PAYMENT_REQUEST_ID = '00000000-0000-4000-8000-000000000901';

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
