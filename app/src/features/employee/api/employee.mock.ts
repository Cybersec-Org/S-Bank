import type { Account } from '@/features/accounts';
import { ApiProblem } from '@/shared/api/problem';
import { demoTransactions } from '@/shared/api/mock/demo-ledger';
import { FAKE_IBANS, mockUuid } from '@/shared/api/mock/mock-data';
import {
  createMockRunner,
  resolveMockOptions,
  type MockOptions,
} from '@/shared/api/mock/mock-runner';

import type { CustomerDetails, CustomerSummary } from '../model/customer';
import type { EmployeeRepository } from './employee.repository';

const HTTP_NOT_FOUND = 404;

export const MOCK_CUSTOMER_ANNA_ID = mockUuid(401);
export const MOCK_CUSTOMER_PIOTR_ID = mockUuid(402);
export const MOCK_CUSTOMER_ZOFIA_ID = mockUuid(403);

const CUSTOMERS: readonly CustomerSummary[] = [
  {
    id: MOCK_CUSTOMER_ANNA_ID,
    displayName: 'Anna Nowak',
    email: 'anna.nowak@example.com',
    customerNumber: 1007,
  },
  {
    id: MOCK_CUSTOMER_PIOTR_ID,
    displayName: 'Piotr Fikcyjny',
    email: 'piotr.fikcyjny@example.test',
    customerNumber: 1012,
  },
  {
    id: MOCK_CUSTOMER_ZOFIA_ID,
    displayName: 'Zofia Wzorcowa',
    email: 'zofia.wzorcowa@example.test',
    customerNumber: 1018,
  },
];

function accountFor(id: number, iban: string, balanceGrosze: number): Account {
  return {
    id: mockUuid(id),
    name: 'Osobisty',
    iban,
    balanceGrosze,
    dailyLimitGrosze: 500_000,
    dailyUsedGrosze: 0,
    status: 'active',
  };
}

function initialAccounts(): Record<string, Account> {
  const anna = accountFor(451, FAKE_IBANS.customerMain, 428_015);
  const piotr = accountFor(452, FAKE_IBANS.customerPiotr, 87_500);
  const zofia = accountFor(453, FAKE_IBANS.customerZofia, 410_000);
  return { [anna.id]: anna, [piotr.id]: piotr, [zofia.id]: zofia };
}

const ACCOUNT_OF_CUSTOMER: Readonly<Record<string, string>> = {
  [MOCK_CUSTOMER_ANNA_ID]: mockUuid(451),
  [MOCK_CUSTOMER_PIOTR_ID]: mockUuid(452),
  [MOCK_CUSTOMER_ZOFIA_ID]: mockUuid(453),
};

export function createMockEmployeeRepository(
  partialOptions?: Partial<MockOptions>,
): EmployeeRepository {
  const runner = createMockRunner(resolveMockOptions(partialOptions));
  let accountsById = initialAccounts();

  function updateAccount(accountId: string, change: Partial<Account>): void {
    const account = accountsById[accountId];
    if (account === undefined) {
      throw new ApiProblem({ status: HTTP_NOT_FOUND });
    }
    accountsById = { ...accountsById, [accountId]: { ...account, ...change } };
  }

  return {
    searchCustomers: (query) =>
      runner.run(() => {
        const needle = query.trim().toLowerCase();
        return runner.empty
          ? []
          : CUSTOMERS.filter(
              (customer) =>
                customer.displayName.toLowerCase().includes(needle) ||
                customer.email.toLowerCase().includes(needle),
            );
      }),
    getCustomerDetails: (customerId) =>
      runner.run((): CustomerDetails => {
        const customer = CUSTOMERS.find((candidate) => candidate.id === customerId);
        const accountId = ACCOUNT_OF_CUSTOMER[customerId];
        const account = accountId === undefined ? undefined : accountsById[accountId];
        if (customer === undefined || account === undefined) {
          throw new ApiProblem({ status: HTTP_NOT_FOUND });
        }
        return {
          customer,
          accounts: [account],
          transactions: demoTransactions(account.id, 460),
        };
      }),
    setDailyLimit: (accountId, limitGrosze) =>
      runner.run(() => updateAccount(accountId, { dailyLimitGrosze: limitGrosze })),
    setAccountBlocked: (accountId, blocked) =>
      runner.run(() => updateAccount(accountId, { status: blocked ? 'blocked' : 'active' })),
  };
}
