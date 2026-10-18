import { ApiProblem } from '@/shared/api/problem';
import {
  FAKE_IBANS,
  MOCK_MAIN_ACCOUNT_ID,
  MOCK_NOW_ISO,
  mockUuid,
} from '@/shared/api/mock/mock-data';
import type { LedgerPort } from '@/shared/api/mock/ledger-port';
import {
  createMockRunner,
  resolveMockOptions,
  type MockOptions,
} from '@/shared/api/mock/mock-runner';
import { toBankDay } from '@/shared/lib/dates';

import type { Account, Transaction, TransactionQuery } from '../model/account';
import type { AccountsRepository } from './accounts.repository';

const HTTP_NOT_FOUND = 404;

export const MOCK_SAVINGS_ACCOUNT_ID = mockUuid(102);

function initialAccounts(): Account[] {
  return [
    {
      id: MOCK_MAIN_ACCOUNT_ID,
      name: 'Konto osobiste',
      iban: FAKE_IBANS.customerMain,
      balanceGrosze: 1_254_320,
      dailyLimitGrosze: 500_000,
      dailyUsedGrosze: 120_000,
      status: 'active',
    },
    {
      id: MOCK_SAVINGS_ACCOUNT_ID,
      name: 'Konto oszczędnościowe',
      iban: FAKE_IBANS.customerSavings,
      balanceGrosze: 3_000_000,
      dailyLimitGrosze: 200_000,
      dailyUsedGrosze: 0,
      status: 'active',
    },
  ];
}

function mainTransaction(
  sequence: number,
  bookedAt: string,
  direction: Transaction['direction'],
  amountGrosze: number,
  title: string,
  counterpartyName: string,
): Transaction {
  return {
    id: mockUuid(1000 + sequence),
    accountId: MOCK_MAIN_ACCOUNT_ID,
    direction,
    amountGrosze,
    title,
    counterpartyName,
    bookedAt,
  };
}

function initialTransactions(): Transaction[] {
  return [
    mainTransaction(
      1,
      '2026-10-15T07:30:00.000Z',
      'outgoing',
      120_000,
      'Opłata za kurs',
      'Szkoła Wzorcowa',
    ),
    mainTransaction(
      2,
      '2026-10-14T08:12:00.000Z',
      'outgoing',
      4_590,
      'Zakupy spożywcze',
      'Sklep Przykładowy',
    ),
    mainTransaction(
      3,
      '2026-10-13T10:00:00.000Z',
      'incoming',
      450_000,
      'Wynagrodzenie za wrzesień',
      'Firma Testowa Sp. z o.o.',
    ),
    mainTransaction(
      4,
      '2026-10-12T16:45:00.000Z',
      'outgoing',
      12_900,
      'Abonament telefoniczny',
      'Operator Demonstracyjny',
    ),
    mainTransaction(
      5,
      '2026-10-10T09:20:00.000Z',
      'outgoing',
      150_000,
      'Czynsz za październik',
      'Zarząd Budynku Wzorcowego',
    ),
    mainTransaction(
      6,
      '2026-10-08T12:05:00.000Z',
      'incoming',
      8_000,
      'Zwrot za bilety',
      'Jan Przykładowy',
    ),
    mainTransaction(
      7,
      '2026-10-05T18:30:00.000Z',
      'outgoing',
      3_250,
      'Kawiarnia',
      'Kawiarnia Testowa',
    ),
    mainTransaction(
      8,
      '2026-09-30T11:00:00.000Z',
      'outgoing',
      21_990,
      'Rachunek za prąd',
      'Energia Przykładowa S.A.',
    ),
    mainTransaction(
      9,
      '2026-09-27T14:15:00.000Z',
      'incoming',
      15_000,
      'Prezent urodzinowy',
      'Maria Demonstracyjna',
    ),
    mainTransaction(10, '2026-09-20T07:50:00.000Z', 'outgoing', 6_780, 'Apteka', 'Apteka Wzorcowa'),
  ];
}

function matchesQuery(transaction: Transaction, query: TransactionQuery): boolean {
  const day = toBankDay(transaction.bookedAt);
  return (
    (query.from === null || day >= query.from) &&
    (query.to === null || day <= query.to) &&
    (query.direction === null || transaction.direction === query.direction)
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
