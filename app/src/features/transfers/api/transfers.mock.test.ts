import { createMockRepositories } from '@/shared/api/repositories';
import type { AssuranceLevel } from '@/shared/auth/roles';
import { FAKE_IBANS, MOCK_MAIN_ACCOUNT_ID } from '@/shared/api/mock/mock-data';

import type { CreateTransferDraftInput } from '../model/transfer';

function setup(acr: AssuranceLevel = '1') {
  let currentAcr = acr;
  const repositories = createMockRepositories(() => currentAcr, { latencyMs: 0 });
  return {
    repositories,
    raiseAcr: () => {
      currentAcr = '2';
    },
  };
}

function buildInput(overrides: Partial<CreateTransferDraftInput> = {}): CreateTransferDraftInput {
  return {
    sourceAccountId: MOCK_MAIN_ACCOUNT_ID,
    recipientName: 'Jan Przykładowy',
    recipientIban: FAKE_IBANS.recipientJan,
    title: 'Test',
    amountGrosze: 10_000,
    ...overrides,
  };
}

describe('mock transfers repository', () => {
  it('flags drafts from 1 000 zł as requiring step-up', async () => {
    const { repositories } = setup();

    const small = await repositories.transfers.createDraft(buildInput({ amountGrosze: 99_999 }));
    const large = await repositories.transfers.createDraft(buildInput({ amountGrosze: 100_000 }));

    expect(small.requiresStepUp).toBe(false);
    expect(large.requiresStepUp).toBe(true);
  });

  it('rejects an invalid IBAN with the invalid_iban problem', async () => {
    const { repositories } = setup();

    await expect(
      repositories.transfers.createDraft(
        buildInput({ recipientIban: 'PL00123456780000000000000003' }),
      ),
    ).rejects.toMatchObject({ status: 422, code: 'invalid_iban' });
  });

  it('answers 404 for a draft on an unknown account', async () => {
    const { repositories } = setup();

    await expect(
      repositories.transfers.createDraft(buildInput({ sourceAccountId: 'unknown' })),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('refuses to confirm a large transfer without step-up, like the API does', async () => {
    const { repositories } = setup('1');
    const draft = await repositories.transfers.createDraft(buildInput({ amountGrosze: 150_000 }));

    await expect(
      repositories.transfers.confirmDraft({ draftId: draft.id, idempotencyKey: 'key-1' }),
    ).rejects.toMatchObject({ status: 403, code: 'step_up_required' });
  });

  it('confirms a large transfer once the assurance level is raised and debits the account', async () => {
    const { repositories, raiseAcr } = setup('1');
    const draft = await repositories.transfers.createDraft(buildInput({ amountGrosze: 150_000 }));
    raiseAcr();

    await repositories.transfers.confirmDraft({ draftId: draft.id, idempotencyKey: 'key-1' });

    const [account] = await repositories.accounts.listAccounts();
    expect(account?.balanceGrosze).toBe(1_254_320 - 150_000);
    expect(account?.dailyUsedGrosze).toBe(120_000 + 150_000);
  });

  it('rejects an amount above the balance', async () => {
    const { repositories, raiseAcr } = setup('1');
    raiseAcr();
    const draft = await repositories.transfers.createDraft(buildInput({ amountGrosze: 2_000_000 }));

    await expect(
      repositories.transfers.confirmDraft({ draftId: draft.id, idempotencyKey: 'key-1' }),
    ).rejects.toMatchObject({ code: 'insufficient_funds' });
  });

  it('rejects an amount above the remaining daily limit', async () => {
    const { repositories, raiseAcr } = setup('1');
    raiseAcr();
    const draft = await repositories.transfers.createDraft(buildInput({ amountGrosze: 400_000 }));

    await expect(
      repositories.transfers.confirmDraft({ draftId: draft.id, idempotencyKey: 'key-1' }),
    ).rejects.toMatchObject({ code: 'daily_limit_exceeded' });
  });

  it('returns the same receipt and debits once when the same idempotency key is replayed', async () => {
    const { repositories } = setup('1');
    const draft = await repositories.transfers.createDraft(buildInput({ amountGrosze: 10_000 }));

    const first = await repositories.transfers.confirmDraft({
      draftId: draft.id,
      idempotencyKey: 'key-1',
    });
    const replay = await repositories.transfers.confirmDraft({
      draftId: draft.id,
      idempotencyKey: 'key-1',
    });

    expect(replay).toEqual(first);
    const [account] = await repositories.accounts.listAccounts();
    expect(account?.balanceGrosze).toBe(1_254_320 - 10_000);
  });

  it('removes a cancelled draft', async () => {
    const { repositories } = setup();
    const draft = await repositories.transfers.createDraft(buildInput());

    await repositories.transfers.cancelDraft(draft.id);

    await expect(repositories.transfers.getDraft(draft.id)).rejects.toMatchObject({ status: 404 });
  });
});
