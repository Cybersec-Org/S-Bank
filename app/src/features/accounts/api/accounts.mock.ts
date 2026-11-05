import { ApiProblem } from '@/shared/api/problem';
import {
  FAKE_IBANS,
  MOCK_MAIN_ACCOUNT_ID,
  MOCK_NOW_ISO,
  mockUuid,
} from '@/shared/api/mock/mock-data';
import { demoTransactions } from '@/shared/api/mock/demo-ledger';
import type { LedgerPort } from '@/shared/api/mock/ledger-port';
import {
  createMockRunner,
  resolveMockOptions,
  type MockOptions,
} from '@/shared/api/mock/mock-runner';
import { toBankDay } from '@/shared/lib/dates';

import {
  isPaymentKind,
  type Account,
  type Transaction,
  type TransactionQuery,
} from '../model/account';
import type { AccountsRepository } from './accounts.repository';

const HTTP_NOT_FOUND = 404;

function initialAccounts(): Account[] {
  return [
    {
      id: MOCK_MAIN_ACCOUNT_ID,
      name: 'Osobisty',
      iban: FAKE_IBANS.customerMain,
      balanceGrosze: 428_015,
      dailyLimitGrosze: 500_000,
      dailyUsedGrosze: 0,
      status: 'active',
    },
  ];
}

function initialTransactions(): Transaction[] {
  return demoTransactions(MOCK_MAIN_ACCOUNT_ID, 1000);
}

function matchesQuery(transaction: Transaction, query: TransactionQuery): boolean {
  const day = toBankDay(transaction.bookedAt);
  return (
    (query.from === null || day >= query.from) &&
    (query.to === null || day <= query.to) &&
    (query.direction === null || transaction.direction === query.direction) &&
    (!query.paymentsOnly || isPaymentKind(transaction.kind))
  );
}

/** Deterministic in-memory accounts; also acts as the mock ledger the transfer mocks debit. */
export function createMockAccountsRepository(
  partialOptions?: Partial<MockOptions>,
): AccountsRepository & LedgerPort {
  const runner = createMockRunner(resolveMockOptions(partialOptions));
  let accounts = initialAccounts();
  let transactions = initialTransactions();
  let operationCounter = 0;

  function findAccount(accountId: string): Account {
    const account = accounts.find((candidate) => candidate.id === accountId);
    if (account === undefined) {
      throw new ApiProblem({ status: HTTP_NOT_FOUND });
    }
    return account;
  }

  return {
    listAccounts: () => runner.run(() => (runner.empty ? [] : accounts)),
    listTransactions: (accountId, query) =>
      runner.run(() => {
        findAccount(accountId);
        if (runner.empty) {
          return [];
        }
        const matching = transactions
          .filter((transaction) => transaction.accountId === accountId)
          .filter((transaction) => matchesQuery(transaction, query))
          .sort((left, right) => right.bookedAt.localeCompare(left.bookedAt));
        return query.limit === null ? matching : matching.slice(0, query.limit);
      }),
    primaryAccountId: () => accounts[0]?.id ?? null,
    getAccountSnapshot: (accountId) => {
      const account = accounts.find((candidate) => candidate.id === accountId);
      if (account === undefined) {
        return null;
      }
      return {
        name: account.name,
        balanceGrosze: account.balanceGrosze,
        remainingDailyLimitGrosze: Math.max(0, account.dailyLimitGrosze - account.dailyUsedGrosze),
        blocked: account.status === 'blocked',
      };
    },
    recordOutgoing: (entry) => {
      operationCounter += 1;
      const reference = `OP-${MOCK_NOW_ISO.slice(0, 4)}-${String(operationCounter).padStart(6, '0')}`;
      accounts = accounts.map((account) =>
        account.id === entry.accountId
          ? {
              ...account,
              balanceGrosze: account.balanceGrosze - entry.amountGrosze,
              dailyUsedGrosze: account.dailyUsedGrosze + entry.amountGrosze,
            }
          : account,
      );
      transactions = [
        {
          id: mockUuid(2000 + operationCounter),
          accountId: entry.accountId,
          direction: 'outgoing',
          kind: entry.kind,
          amountGrosze: entry.amountGrosze,
          title: entry.title,
          counterpartyName: entry.counterpartyName,
          bookedAt: MOCK_NOW_ISO,
        },
        ...transactions,
      ];
      return reference;
    },
  };
}
