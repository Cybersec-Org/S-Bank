import { pl } from '@/shared/i18n/pl';

import type { TransferFormErrorCode } from './transfer-form';

export const TRANSFER_ERROR_MESSAGES: Readonly<Record<TransferFormErrorCode, string>> = {
  recipientRequired: pl.transfer.errorRecipientRequired,
  ibanInvalid: pl.transfer.errorIbanInvalid,
  amountInvalid: pl.transfer.errorAmountInvalid,
  amountExceedsBalance: pl.transfer.errorAmountExceedsBalance,
  amountExceedsLimit: pl.transfer.errorAmountExceedsLimit,
  titleRequired: pl.transfer.errorTitleRequired,
  accountBlocked: pl.transfer.errorAccountBlocked,
};
