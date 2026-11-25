import { createFakeDevApi, devApiAccount, devApiTransaction } from '@/shared/testing/fake-dev-api';

import { createDevHttpEmployeeRepository } from './employee.dev-http';

const EMPLOYEE = { userId: 'emp-1', role: 'EMPLOYEE' } as const;
const OWN_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER = {
  id: 'client-1',
  firstName: 'Jan',
  lastName: 'Kowalski',
  email: 'jan.kowalski@example.com',
  customerNumber: 'CUST-1001',
};

describe('dev API employee repository', () => {
  it('searches customers as the employee', async () => {
    const { transport, requests } = createFakeDevApi(
      { 'GET /customers': { body: [{ ...CUSTOMER, accounts: [devApiAccount()] }] } },
      EMPLOYEE,
    );

    const found = await createDevHttpEmployeeRepository(transport).searchCustomers(' Kowal ');

    expect(found).toEqual([
      {
        id: 'client-1',
        displayName: 'Jan Kowalski',
        email: 'jan.kowalski@example.com',
        customerNumber: 'CUST-1001',
      },
    ]);
    expect(requests[0]?.url).toContain('query=Kowal');
    expect(requests[0]?.headers).toMatchObject({ 'x-user-role': 'EMPLOYEE' });
  });

  it('maps details with PLN accounts and their history, newest first', async () => {
    const { transport } = createFakeDevApi(
      {
        'GET /customers/client-1': {
          body: {
            ...CUSTOMER,
            accounts: [devApiAccount(), devApiAccount({ id: 'eur', currency: 'EUR' })],
            transactions: [
              devApiTransaction(),
              devApiTransaction({
                id: 'eur-tx',
                senderAccountId: 'eur',
                executedAt: '2026-11-11T00:00:00.000Z',
              }),
            ],
          },
        },
      },
      EMPLOYEE,
    );

    const details = await createDevHttpEmployeeRepository(transport).getCustomerDetails('client-1');

    expect(details.customer.displayName).toBe('Jan Kowalski');
    expect(details.accounts.map((account) => account.id)).toEqual([OWN_ID]);
    expect(details.transactions).toEqual([
      expect.objectContaining({ accountId: OWN_ID, direction: 'outgoing' }),
    ]);
  });

  it('sends the limit in złoty and the block as FROZEN', async () => {
    const { transport, requests } = createFakeDevApi(
      {
        [`PATCH /accounts/${OWN_ID}/limit`]: { body: devApiAccount() },
        [`PATCH /accounts/${OWN_ID}/status`]: { body: devApiAccount({ status: 'FROZEN' }) },
      },
      EMPLOYEE,
    );
    const repository = createDevHttpEmployeeRepository(transport);

    await repository.setDailyLimit(OWN_ID, 350_000);
    await repository.setAccountBlocked(OWN_ID, true);
    await repository.setAccountBlocked(OWN_ID, false);

    expect(requests.map((request) => request.body)).toEqual([
      { newLimit: 3500 },
      { status: 'FROZEN' },
      { status: 'ACTIVE' },
    ]);
  });
});
