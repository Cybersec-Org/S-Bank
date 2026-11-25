import { createFakeDevApi } from '@/shared/testing/fake-dev-api';

import { createDevHttpTransfersRepository } from './transfers.dev-http';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const DRAFT_ID = '44444444-4444-4444-8444-444444444444';
const INPUT = {
  sourceAccountId: ACCOUNT_ID,
  recipientName: 'Anna Nowak',
  recipientIban: 'PL47102010260000140202736453',
  title: 'Obiad',
  amountGrosze: 150_050,
};

const DRAFT_BODY = {
  id: DRAFT_ID,
  status: 'DRAFT',
  senderAccountId: ACCOUNT_ID,
  senderIban: 'PL04102010260000140202736451',
  receiverIban: INPUT.recipientIban,
  receiverName: INPUT.recipientName,
  amount: 1500.5,
  currency: 'PLN',
  title: INPUT.title,
  createdAt: '2026-11-11T10:00:00.000Z',
};

function setup() {
  return createFakeDevApi({
    'POST /transfers': { status: 201, body: DRAFT_BODY },
    [`POST /transfers/${DRAFT_ID}/confirm`]: {
      body: {
        id: DRAFT_ID,
        status: 'COMPLETED',
        operationNumber: 'OP-1762855200000-1234',
        executedAt: '2026-11-11T10:00:30.000Z',
        amount: 1500.5,
        currency: 'PLN',
      },
    },
    [`POST /transfers/${DRAFT_ID}/cancel`]: { body: { id: DRAFT_ID, status: 'CANCELLED' } },
  });
}

describe('dev API transfers repository', () => {
  it('creates the draft on the server with the amount in złoty', async () => {
    const { transport, requests } = setup();

    const draft = await createDevHttpTransfersRepository(transport).createDraft(INPUT);

    expect(requests[0]?.body).toEqual({
      senderAccountId: ACCOUNT_ID,
      receiverIban: INPUT.recipientIban,
      receiverName: INPUT.recipientName,
      amount: 1500.5,
      title: INPUT.title,
    });
    expect(draft).toMatchObject({ id: DRAFT_ID, amountGrosze: 150_050, requiresStepUp: true });
  });

  it('serves a draft of this session by id, and 404 for an unknown one', async () => {
    const { transport } = setup();
    const repository = createDevHttpTransfersRepository(transport);
    await repository.createDraft(INPUT);

    await expect(repository.getDraft(DRAFT_ID)).resolves.toMatchObject({ title: 'Obiad' });
    await expect(repository.getDraft('unknown')).rejects.toMatchObject({ status: 404 });
  });

  it('confirms once per idempotency key and returns the operation number', async () => {
    const { transport, requests } = setup();
    const repository = createDevHttpTransfersRepository(transport);
    await repository.createDraft(INPUT);

    const first = await repository.confirmDraft({ draftId: DRAFT_ID, idempotencyKey: 'k1' });
    const retry = await repository.confirmDraft({ draftId: DRAFT_ID, idempotencyKey: 'k1' });

    expect(first).toEqual({
      reference: 'OP-1762855200000-1234',
      executedAt: '2026-11-11T10:00:30.000Z',
    });
    expect(retry).toBe(first);
    expect(requests.filter((request) => request.url.endsWith('/confirm'))).toHaveLength(1);
  });

  it('cancels on the server and forgets the draft', async () => {
    const { transport } = setup();
    const repository = createDevHttpTransfersRepository(transport);
    await repository.createDraft(INPUT);

    await repository.cancelDraft(DRAFT_ID);

    await expect(repository.getDraft(DRAFT_ID)).rejects.toMatchObject({ status: 404 });
  });

  it('passes the server refusal through as a typed problem', async () => {
    const { transport } = createFakeDevApi({
      'POST /transfers': {
        status: 404,
        body: { code: 'RECIPIENT_NOT_FOUND', message: 'not in this bank' },
      },
    });

    await expect(
      createDevHttpTransfersRepository(transport).createDraft(INPUT),
    ).rejects.toMatchObject({ status: 404, code: 'recipient_not_found' });
  });
});
