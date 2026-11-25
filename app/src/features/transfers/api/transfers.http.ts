import { z } from 'zod';

import {
  groszeToPln,
  plnToGrosze,
  voidResponseSchema,
  type HttpTransport,
} from '@/shared/api/http';
import { normalizeIban } from '@/shared/lib/iban';
import { amountRequiresStepUp } from '@/shared/lib/step-up';

import type { CreateTransferDraftInput, TransferDraft, TransferReceipt } from '../model/transfer';
import type { ConfirmTransferInput, TransfersRepository } from './transfers.repository';

const apiDraftSchema = z.object({
  id: z.string(),
  senderAccountId: z.string(),
  receiverName: z.string(),
  receiverIban: z.string(),
  title: z.string(),
  amount: z.number(),
  requiresStepUp: z.boolean().optional(),
});

const apiConfirmSchema = z.object({
  operationNumber: z.string(),
  executedAt: z.string(),
});

function mapApiDraft(raw: z.infer<typeof apiDraftSchema>): TransferDraft {
  const amountGrosze = plnToGrosze(raw.amount);
  return {
    id: raw.id,
    sourceAccountId: raw.senderAccountId,
    sourceAccountName: 'Osobisty',
    recipientName: raw.receiverName,
    recipientIban: raw.receiverIban,
    title: raw.title,
    amountGrosze,
    requiresStepUp: raw.requiresStepUp ?? amountRequiresStepUp(amountGrosze),
  };
}

export function createHttpTransfersRepository(transport: HttpTransport): TransfersRepository {
  return {
    async createDraft(input: CreateTransferDraftInput) {
      const created = await transport.requestJson('/transfers', apiDraftSchema, {
        method: 'POST',
        body: {
          senderAccountId: input.sourceAccountId,
          receiverIban: normalizeIban(input.recipientIban),
          receiverName: input.recipientName.trim(),
          amount: groszeToPln(input.amountGrosze),
          title: input.title.trim(),
        },
      });
      return mapApiDraft(created);
    },
    async getDraft(draftId: string) {
      const draft = await transport.requestJson(
        `/transfers/${encodeURIComponent(draftId)}`,
        apiDraftSchema,
      );
      return mapApiDraft(draft);
    },
    async confirmDraft(input: ConfirmTransferInput): Promise<TransferReceipt> {
      const receipt = await transport.requestJson(
        `/transfers/${encodeURIComponent(input.draftId)}/confirm`,
        apiConfirmSchema,
        {
          method: 'POST',
          body: { idempotencyKey: input.idempotencyKey },
        },
      );
      return {
        reference: receipt.operationNumber,
        executedAt: receipt.executedAt,
      };
    },
    async cancelDraft(draftId: string) {
      await transport.requestJson(
        `/transfers/${encodeURIComponent(draftId)}/cancel`,
        voidResponseSchema,
        { method: 'POST' },
      );
    },
  };
}
