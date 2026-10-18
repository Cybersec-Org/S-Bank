/**
 * UX mirror of the server rule (SR-03): the API checks `acr` and `auth_time` itself and is the only
 * authority. The app uses the threshold to explain the step-up before the user hits it.
 */
export const STEP_UP_THRESHOLD_GROSZE = 100_000;

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

export function amountRequiresStepUp(amountGrosze: number): boolean {
  return amountGrosze >= STEP_UP_THRESHOLD_GROSZE;
}
