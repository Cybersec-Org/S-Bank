import { ApiProblem } from '@/shared/api/problem';
import type { LedgerPort } from '@/shared/api/mock/ledger-port';
import { MOCK_NOW_ISO, mockUuid } from '@/shared/api/mock/mock-data';
import {
  createMockRunner,
  resolveMockOptions,
  type MockOptions,
} from '@/shared/api/mock/mock-runner';
import type { AssuranceLevel } from '@/shared/auth/roles';
import { isValidPolishIban } from '@/shared/lib/iban';

import { amountRequiresStepUp, type TransferDraft, type TransferReceipt } from '../model/transfer';
import type { TransfersRepository } from './transfers.repository';

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE = 422;
const FIRST_DRAFT_SEQUENCE = 700;
const STEP_UP_LEVEL: AssuranceLevel = '2';

interface MockTransfersDependencies {
  readonly ledger: LedgerPort;
  readonly getAcr: () => AssuranceLevel;
}

/** Mock of the server-side draft + confirm flow, including the checks the real API performs. */
export function createMockTransfersRepository(
  dependencies: MockTransfersDependencies,
  partialOptions?: Partial<MockOptions>,
): TransfersRepository {
  const runner = createMockRunner(resolveMockOptions(partialOptions));
  const drafts = new Map<string, TransferDraft>();
  const receiptsByKey = new Map<string, TransferReceipt>();
  let nextSequence = FIRST_DRAFT_SEQUENCE;

  function requireDraft(draftId: string): TransferDraft {
    const draft = drafts.get(draftId);
    if (draft === undefined) {
      throw new ApiProblem({ status: HTTP_NOT_FOUND });
    }
    return draft;
  }

  return {
    createDraft: (input) =>
      runner.run(() => {
        const source = dependencies.ledger.getAccountSnapshot(input.sourceAccountId);
        if (source === null) {
          throw new ApiProblem({ status: HTTP_NOT_FOUND });
        }
        if (!isValidPolishIban(input.recipientIban)) {
          throw new ApiProblem({ status: HTTP_UNPROCESSABLE, code: 'invalid_iban' });
        }
        nextSequence += 1;
        const draft: TransferDraft = {
          id: mockUuid(nextSequence),
          sourceAccountId: input.sourceAccountId,
          sourceAccountName: source.name,
          recipientName: input.recipientName,
          recipientIban: input.recipientIban,
          title: input.title,
          amountGrosze: input.amountGrosze,
          requiresStepUp: amountRequiresStepUp(input.amountGrosze),
        };
        drafts.set(draft.id, draft);
        return draft;
      }),
    getDraft: (draftId) => runner.run(() => requireDraft(draftId)),
    confirmDraft: ({ draftId, idempotencyKey }) =>
      runner.run(() => {
        const earlier = receiptsByKey.get(idempotencyKey);
        if (earlier !== undefined) {
          return earlier;
        }
        const draft = requireDraft(draftId);
        if (draft.requiresStepUp && dependencies.getAcr() !== STEP_UP_LEVEL) {
          throw new ApiProblem({ status: HTTP_FORBIDDEN, code: 'step_up_required' });
        }
        const snapshot = dependencies.ledger.getAccountSnapshot(draft.sourceAccountId);
        if (snapshot === null) {
          throw new ApiProblem({ status: HTTP_NOT_FOUND });
        }
        if (snapshot.blocked) {
          throw new ApiProblem({ status: HTTP_FORBIDDEN, code: 'account_blocked' });
        }
        if (draft.amountGrosze > snapshot.balanceGrosze) {
          throw new ApiProblem({ status: HTTP_UNPROCESSABLE, code: 'insufficient_funds' });
        }
        if (draft.amountGrosze > snapshot.remainingDailyLimitGrosze) {
          throw new ApiProblem({ status: HTTP_UNPROCESSABLE, code: 'daily_limit_exceeded' });
        }
        const reference = dependencies.ledger.recordOutgoing({
          accountId: draft.sourceAccountId,
          amountGrosze: draft.amountGrosze,
          title: draft.title,
          counterpartyName: draft.recipientName,
        });
        const receipt: TransferReceipt = { reference, executedAt: MOCK_NOW_ISO };
        receiptsByKey.set(idempotencyKey, receipt);
        drafts.delete(draftId);
        return receipt;
      }),
    cancelDraft: (draftId) =>
      runner.run(() => {
        requireDraft(draftId);
        drafts.delete(draftId);
      }),
  };
}
