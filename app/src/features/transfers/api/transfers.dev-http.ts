import { z } from 'zod';

import { pathSegment, type DevApiTransport } from '@/shared/api/dev-api-transport';
import { ApiProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { groszeToZloty, zlotyToGrosze } from '@/shared/lib/money';

import { amountRequiresStepUp, type TransferDraft, type TransferReceipt } from '../model/transfer';
import type { TransfersRepository } from './transfers.repository';

const HTTP_NOT_FOUND = 404;

const draftResponseSchema = z.object({
  id: z.string().min(1),
  senderAccountId: z.string().min(1),
  receiverIban: z.string().min(1),
  receiverName: z.string(),
  amount: z.number(),
  title: z.string(),
});

const confirmResponseSchema = z.object({
  operationNumber: z.string().min(1),
  executedAt: z.string().min(1),
});

const cancelResponseSchema = z.object({ id: z.string(), status: z.string() });

/**
 * Two-step transfer of the dev API: `POST /transfers` (draft, checked by the server), then
 * `POST /transfers/:id/confirm` or `/cancel`.
 *
 * Gaps of that API, handled here and not to be mistaken for security:
 * - there is no `GET /transfers/:id`, so drafts created in this session are kept in memory (never persisted);
 * - there is no `Idempotency-Key`, so a receipt is reused only for a retry inside this session;
 * - the server has no step-up yet: `requiresStepUp` (1 000 zł) is a client-side mirror for the UI.
 */
export function createDevHttpTransfersRepository(transport: DevApiTransport): TransfersRepository {
  const drafts = new Map<string, TransferDraft>();
  const receiptsByKey = new Map<string, TransferReceipt>();

  function requireDraft(draftId: string): TransferDraft {
    const draft = drafts.get(draftId);
    if (draft === undefined) {
      throw new ApiProblem({ status: HTTP_NOT_FOUND });
    }
    return draft;
  }

  return {
    createDraft: async (input) => {
      const created = await transport.request({
        method: 'POST',
        path: '/transfers',
        schema: draftResponseSchema,
        body: {
          senderAccountId: input.sourceAccountId,
          receiverIban: input.recipientIban,
          receiverName: input.recipientName,
          amount: groszeToZloty(input.amountGrosze),
          title: input.title,
        },
      });
      const amountGrosze = zlotyToGrosze(created.amount);
      const draft: TransferDraft = {
        id: created.id,
        sourceAccountId: created.senderAccountId,
        sourceAccountName: pl.dashboard.defaultAccountName,
        recipientName: created.receiverName,
        recipientIban: created.receiverIban,
        title: created.title,
        amountGrosze,
        requiresStepUp: amountRequiresStepUp(amountGrosze),
      };
      drafts.set(draft.id, draft);
      return draft;
    },
    getDraft: (draftId) => Promise.resolve().then(() => requireDraft(draftId)),
    confirmDraft: async ({ draftId, idempotencyKey }) => {
      const earlier = receiptsByKey.get(idempotencyKey);
      if (earlier !== undefined) {
        return earlier;
      }
      const confirmed = await transport.request({
        method: 'POST',
        path: `/transfers/${pathSegment(draftId)}/confirm`,
        schema: confirmResponseSchema,
      });
      const receipt: TransferReceipt = {
        reference: confirmed.operationNumber,
        executedAt: confirmed.executedAt,
      };
      receiptsByKey.set(idempotencyKey, receipt);
      drafts.delete(draftId);
      return receipt;
    },
    cancelDraft: async (draftId) => {
      await transport.request({
        method: 'POST',
        path: `/transfers/${pathSegment(draftId)}/cancel`,
        schema: cancelResponseSchema,
      });
      drafts.delete(draftId);
    },
  };
}
