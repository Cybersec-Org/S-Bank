import { createFakeDevApi, devApiAccount, devApiTransaction } from '@/shared/testing/fake-dev-api';

import { ALL_TRANSACTIONS } from '../model/account';
import { pl } from '@/shared/i18n/pl';

import { createDevHttpAccountsRepository } from './accounts.dev-http';

const OWN_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';

describe('dev API accounts repository', () => {
  it('maps PLN accounts to grosze and hides foreign-currency accounts', async () => {
    const { transport } = createFakeDevApi({
      'GET /accounts': {
        body: [devApiAccount(), devApiAccount({ id: 'eur', currency: 'EUR', balance: 1200.5 })],
      },
    });

    const accounts = await createDevHttpAccountsRepository(transport).listAccounts();

    expect(accounts).toEqual([
      {
        id: OWN_ID,
        name: pl.dashboard.defaultAccountName,
        iban: 'PL04102010260000140202736451',
        balanceGrosze: 475_050,
        dailyLimitGrosze: 200_000,
        dailyUsedGrosze: 25_000,
        status: 'active',
      },
    ]);
  });

  it('shows a frozen or closed account as blocked', async () => {
    const { transport } = createFakeDevApi({
      'GET /accounts': { body: [devApiAccount({ status: 'FROZEN' })] },
    });

    const [account] = await createDevHttpAccountsRepository(transport).listAccounts();

    expect(account?.status).toBe('blocked');
  });

  it('derives direction from the account and filters the history locally', async () => {
    const { transport, requests } = createFakeDevApi({
      [`GET /accounts/${OWN_ID}/transactions`]: {
        body: [
          devApiTransaction(),
          devApiTransaction({
            id: 'in-1',
            senderAccountId: OTHER_ID,
            receiverAccountId: OWN_ID,
            receiverName: 'Jan Kowalski',
            amount: 99.99,
            title: 'Zwrot',
            executedAt: '2026-11-11T08:00:00.000Z',
          }),
        ],
      },
    });
    const repository = createDevHttpAccountsRepository(transport);

    const all = await repository.listTransactions(OWN_ID, ALL_TRANSACTIONS);
    const incoming = await repository.listTransactions(OWN_ID, {
      ...ALL_TRANSACTIONS,
      direction: 'incoming',
    });

    expect(all.map((transaction) => transaction.direction)).toEqual(['incoming', 'outgoing']);
    expect(all[1]).toMatchObject({
      accountId: OWN_ID,
      amountGrosze: 25_000,
      counterpartyName: 'Anna Nowak',
      bookedAt: '2026-11-10T09:00:05.000Z',
      kind: 'transfer',
    });
    expect(incoming).toEqual([
      expect.objectContaining({
        id: 'in-1',
        amountGrosze: 9_999,
        counterpartyName: pl.history.incomingCounterparty,
      }),
    ]);
    expect(requests[0]?.url).not.toContain('?');
  });
});
