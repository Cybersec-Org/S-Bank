import type { CreateTransferDraftInput, TransferDraft, TransferReceipt } from '../model/transfer';

export interface ConfirmTransferInput {
  readonly draftId: string;
  /** One key per user intent; reused when the same confirmation is retried (SR-07). */
  readonly idempotencyKey: string;
}

export interface TransfersRepository {
  createDraft: (input: CreateTransferDraftInput) => Promise<TransferDraft>;
  getDraft: (draftId: string) => Promise<TransferDraft>;
  confirmDraft: (input: ConfirmTransferInput) => Promise<TransferReceipt>;
  cancelDraft: (draftId: string) => Promise<void>;
}
