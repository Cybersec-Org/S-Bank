export { STEP_UP_THRESHOLD_GROSZE, amountRequiresStepUp } from '@/shared/lib/step-up';

// B-18: switch to the generated schema types once the transfer endpoints exist.
export interface TransferDraft {
  readonly id: string;
  readonly sourceAccountId: string;
  readonly sourceAccountName: string;
  readonly recipientName: string;
  readonly recipientIban: string;
  readonly title: string;
  readonly amountGrosze: number;
  readonly requiresStepUp: boolean;
}

export interface CreateTransferDraftInput {
  readonly sourceAccountId: string;
  readonly recipientName: string;
  readonly recipientIban: string;
  readonly title: string;
  readonly amountGrosze: number;
}

export interface TransferReceipt {
  readonly reference: string;
  readonly executedAt: string;
}
