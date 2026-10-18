import { isValidPolishIban, normalizeIban } from '@/shared/lib/iban';
import { parseAmountToGrosze } from '@/shared/lib/money';

import type { CreateTransferDraftInput } from './transfer';

export type TransferField = 'recipientName' | 'iban' | 'amount' | 'title' | 'account';

export type TransferFormErrorCode =
  | 'recipientRequired'
  | 'ibanInvalid'
  | 'amountInvalid'
  | 'amountExceedsBalance'
  | 'amountExceedsLimit'
  | 'titleRequired'
  | 'accountBlocked';

export interface TransferFormInput {
  readonly sourceAccountId: string;
  readonly recipientName: string;
  readonly iban: string;
  readonly amount: string;
  readonly title: string;
}

/** What the form knows about the chosen account; used only to warn early, the server decides. */
export interface SourceAccountContext {
  readonly balanceGrosze: number;
  readonly remainingDailyLimitGrosze: number;
  readonly blocked: boolean;
}

export type TransferFormErrors = Readonly<Partial<Record<TransferField, TransferFormErrorCode>>>;

export interface TransferFormResult {
  readonly errors: TransferFormErrors;
  /** Present only when the whole form is valid. */
  readonly draftInput: CreateTransferDraftInput | null;
  /** Parsed amount while it is a valid number, for the live step-up notice. */
  readonly amountGrosze: number | null;
}

/** Validates the transfer form with the same rules the API applies (IBAN checksum, amount, limits). */
export function validateTransferForm(
  input: TransferFormInput,
  account: SourceAccountContext | null,
): TransferFormResult {
  const amountGrosze = parseAmountToGrosze(input.amount);
  const positiveAmount = amountGrosze !== null && amountGrosze > 0 ? amountGrosze : null;
  const errors: Partial<Record<TransferField, TransferFormErrorCode>> = {};

  if (input.recipientName.trim() === '') {
    errors.recipientName = 'recipientRequired';
  }
  if (!isValidPolishIban(input.iban)) {
    errors.iban = 'ibanInvalid';
  }
  if (input.title.trim() === '') {
    errors.title = 'titleRequired';
  }
  if (positiveAmount === null) {
    errors.amount = 'amountInvalid';
  } else if (account !== null && positiveAmount > account.balanceGrosze) {
    errors.amount = 'amountExceedsBalance';
  } else if (account !== null && positiveAmount > account.remainingDailyLimitGrosze) {
    errors.amount = 'amountExceedsLimit';
  }
  if (account?.blocked === true) {
    errors.account = 'accountBlocked';
  }

  const valid = Object.keys(errors).length === 0 && positiveAmount !== null;
  return {
    errors,
    amountGrosze: positiveAmount,
    draftInput: valid
      ? {
          sourceAccountId: input.sourceAccountId,
          recipientName: input.recipientName.trim(),
          recipientIban: normalizeIban(input.iban),
          title: input.title.trim(),
          amountGrosze: positiveAmount,
        }
      : null,
  };
}
