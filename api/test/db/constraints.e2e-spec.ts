import { afterAll, beforeAll, describe, it } from 'vitest';
import { MAX_DAILY_LIMIT_GROSZE as MAX_DAILY_LIMIT_GROSZE_NUMBER } from '../../src/config/defaults.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, type TestApp } from '../helpers/create-test-app.js';
import {
  expectDatabaseRejection,
  inRolledBackTransaction,
  insertAccount,
  insertCustomer,
  insertTransaction,
  randomFakeIban,
} from '../helpers/database.js';

/** The CHECK in `init_core` hard-codes the same bound; a mismatch fails the test below. */
const MAX_DAILY_LIMIT_GROSZE = BigInt(MAX_DAILY_LIMIT_GROSZE_NUMBER);

describe('database constraints (init_core)', () => {
  let testApp: TestApp;
  let prisma: PrismaService;

  beforeAll(async () => {
    testApp = await createTestApp({ useDatabase: true });
    prisma = testApp.app.get(PrismaService);
  });

  afterAll(async () => {
    await testApp.close();
  });

  describe('accounts.balance_grosze', () => {
    it('rejects a negative balance on insert', async () => {
      await inRolledBackTransaction(prisma, async (transaction) => {
        const ownerId = await insertCustomer(transaction);
        await expectDatabaseRejection(
          insertAccount(transaction, ownerId, { balanceGrosze: -1n }),
          /accounts_balance_grosze_non_negative/,
        );
      });
    });

    it('rejects an update that would overdraw the account', async () => {
      await inRolledBackTransaction(prisma, async (transaction) => {
        const ownerId = await insertCustomer(transaction);
        const accountId = await insertAccount(transaction, ownerId, { balanceGrosze: 500n });
        await expectDatabaseRejection(
          transaction.$executeRaw`
            UPDATE accounts SET balance_grosze = balance_grosze - 501 WHERE id = ${accountId}::uuid`,
          /accounts_balance_grosze_non_negative/,
        );
      });
    });

    it('accepts a balance of exactly zero', async () => {
      await inRolledBackTransaction(prisma, async (transaction) => {
        const ownerId = await insertCustomer(transaction);
        await insertAccount(transaction, ownerId, { balanceGrosze: 0n });
      });
    });
  });

  describe('transactions.amount_grosze', () => {
    it.each([0n, -1n])('rejects the amount %s', async (amountGrosze) => {
      await inRolledBackTransaction(prisma, async (transaction) => {
        const ownerId = await insertCustomer(transaction);
        const accountId = await insertAccount(transaction, ownerId);
        await expectDatabaseRejection(
          insertTransaction(transaction, accountId, { amountGrosze }),
          /transactions_amount_grosze_positive/,
        );
      });
    });

    it('accepts one grosz', async () => {
      await inRolledBackTransaction(prisma, async (transaction) => {
        const ownerId = await insertCustomer(transaction);
        const accountId = await insertAccount(transaction, ownerId);
        await insertTransaction(transaction, accountId, { amountGrosze: 1n });
      });
    });
  });

  describe('accounts.daily_limit_grosze', () => {
    it.each([MAX_DAILY_LIMIT_GROSZE + 1n, -1n])(
      'rejects the limit %s',
      async (dailyLimitGrosze) => {
        await inRolledBackTransaction(prisma, async (transaction) => {
          const ownerId = await insertCustomer(transaction);
          await expectDatabaseRejection(
            insertAccount(transaction, ownerId, { dailyLimitGrosze }),
            /accounts_daily_limit_grosze_in_range/,
          );
        });
      },
    );

    it.each([0n, MAX_DAILY_LIMIT_GROSZE])('accepts the boundary %s', async (dailyLimitGrosze) => {
      await inRolledBackTransaction(prisma, async (transaction) => {
        const ownerId = await insertCustomer(transaction);
        await insertAccount(transaction, ownerId, { dailyLimitGrosze });
      });
    });
  });

  describe('normalized identifiers', () => {
    it.each([
      ['lowercase', 'pl00123456789012345678901234'],
      ['with spaces', 'PL00 1234 5678 9012 3456 7890 1234'],
      ['too short', 'PL001234'],
    ])('rejects an account IBAN that is %s', async (_label, iban) => {
      await inRolledBackTransaction(prisma, async (transaction) => {
        const ownerId = await insertCustomer(transaction);
        await expectDatabaseRejection(
          insertAccount(transaction, ownerId, { iban }),
          /accounts_iban_normalized/,
        );
      });
    });

    it('rejects a counterparty IBAN that is not normalized', async () => {
      await inRolledBackTransaction(prisma, async (transaction) => {
        const ownerId = await insertCustomer(transaction);
        const accountId = await insertAccount(transaction, ownerId);
        await expectDatabaseRejection(
          insertTransaction(transaction, accountId, { counterpartyIban: 'pl 00' }),
          /transactions_counterparty_iban_normalized/,
        );
      });
    });

    it('rejects a currency code that is not three uppercase letters', async () => {
      await inRolledBackTransaction(prisma, async (transaction) => {
        const ownerId = await insertCustomer(transaction);
        await expectDatabaseRejection(
          insertAccount(transaction, ownerId, { currency: 'pln' }),
          /accounts_currency_iso_4217_shape/,
        );
      });
    });

    it('rejects a second account with the same IBAN', async () => {
      await inRolledBackTransaction(prisma, async (transaction) => {
        const ownerId = await insertCustomer(transaction);
        const iban = randomFakeIban();
        await insertAccount(transaction, ownerId, { iban });
        await expectDatabaseRejection(
          insertAccount(transaction, ownerId, { iban }),
          /accounts_iban_key|unique/i,
        );
      });
    });
  });

  describe('financial history is never cascaded away', () => {
    // The table owner reaches the foreign key (PostgreSQL words a RESTRICT action as "violates RESTRICT
    // setting of foreign key constraint"); a role without DELETE is stopped even earlier.
    const rejection = /foreign key constraint|permission denied/;

    it('refuses to delete an account that has ledger rows', async () => {
      await inRolledBackTransaction(prisma, async (transaction) => {
        const ownerId = await insertCustomer(transaction);
        const accountId = await insertAccount(transaction, ownerId);
        await insertTransaction(transaction, accountId);
        await expectDatabaseRejection(
          transaction.$executeRaw`DELETE FROM accounts WHERE id = ${accountId}::uuid`,
          rejection,
        );
      });
    });

    it('refuses to delete a customer that owns an account', async () => {
      await inRolledBackTransaction(prisma, async (transaction) => {
        const ownerId = await insertCustomer(transaction);
        await insertAccount(transaction, ownerId);
        await expectDatabaseRejection(
          transaction.$executeRaw`DELETE FROM customers WHERE id = ${ownerId}::uuid`,
          rejection,
        );
      });
    });
  });
});
