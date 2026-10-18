import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertSeedAllowed,
  calculateLedgerBalanceGrosze,
  DEMO_CUSTOMERS,
  seedDemoData,
} from '../../prisma/seed-data.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, type TestApp } from '../helpers/create-test-app.js';
import {
  inRolledBackTransaction,
  tryAssumeApplicationRole,
  type TestTransaction,
} from '../helpers/database.js';

const ANNA_BALANCE_GROSZE = 1_250_000n;
const JAN_BALANCE_GROSZE = 320_000n;

/** Independent mod-97 check (ISO 13616) so the seed's IBANs are verified, not assumed. */
function hasValidIbanChecksum(iban: string): boolean {
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  const digits = [...rearranged]
    .map((character) =>
      /[A-Z]/.test(character) ? String(character.charCodeAt(0) - 55) : character,
    )
    .join('');
  let remainder = 0;
  for (const digit of digits) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

describe('seed data (pure rules)', () => {
  it('derives each balance from its ledger', () => {
    const [anna, jan] = DEMO_CUSTOMERS;

    expect(calculateLedgerBalanceGrosze(anna?.ledger ?? [])).toBe(ANNA_BALANCE_GROSZE);
    expect(calculateLedgerBalanceGrosze(jan?.ledger ?? [])).toBe(JAN_BALANCE_GROSZE);
  });

  it('uses valid, obviously fake IBANs in the 1234 5678 range and positive amounts', () => {
    for (const customer of DEMO_CUSTOMERS) {
      const ibans = [customer.iban, ...customer.ledger.map((entry) => entry.counterpartyIban)];
      for (const iban of ibans) {
        expect(iban).toMatch(/^PL\d{26}$/);
        expect(iban.slice(4, 12)).toBe('12345678');
        expect(hasValidIbanChecksum(iban)).toBe(true);
      }
      expect(customer.ledger.every((entry) => entry.amountGrosze > 0n)).toBe(true);
      expect(customer.subject).toMatch(/^seed-subject-/);
    }
  });

  it('has unique ledger ids so a re-run cannot duplicate rows', () => {
    const ids = DEMO_CUSTOMERS.flatMap((customer) => customer.ledger.map((entry) => entry.id));

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('refuses to run in production only', () => {
    expect(() => assertSeedAllowed('production')).toThrow(/Refusing to seed/);
    expect(() => assertSeedAllowed('development')).not.toThrow();
    expect(() => assertSeedAllowed(undefined)).not.toThrow();
  });
});

describe('seed against the database', () => {
  let testApp: TestApp;
  let prisma: PrismaService;

  beforeAll(async () => {
    testApp = await createTestApp({ useDatabase: true });
    prisma = testApp.app.get(PrismaService);
  });

  afterAll(async () => {
    await testApp.close();
  });

  async function countDemoRows(transaction: TestTransaction) {
    const subjects = DEMO_CUSTOMERS.map((customer) => customer.subject);
    const ibans = DEMO_CUSTOMERS.map((customer) => customer.iban);
    const rows = await transaction.$queryRaw<
      { customers: bigint; accounts: bigint; ledger: bigint }[]
    >`
      SELECT
        (SELECT count(*) FROM customers WHERE subject = ANY(${subjects}::text[])) AS customers,
        (SELECT count(*) FROM accounts WHERE iban = ANY(${ibans}::text[])) AS accounts,
        (SELECT count(*) FROM transactions t JOIN accounts a ON a.id = t.account_id
          WHERE a.iban = ANY(${ibans}::text[])) AS ledger`;
    return rows[0];
  }

  async function expectBalancesToMatchLedgers(transaction: TestTransaction): Promise<void> {
    const ibans = DEMO_CUSTOMERS.map((customer) => customer.iban);
    const mismatches = await transaction.$queryRaw<{ iban: string }[]>`
      SELECT a.iban
      FROM accounts a
      WHERE a.iban = ANY(${ibans}::text[])
        AND a.balance_grosze <> (
          SELECT COALESCE(SUM(CASE t.direction WHEN 'CREDIT' THEN t.amount_grosze ELSE -t.amount_grosze END), 0)
          FROM transactions t WHERE t.account_id = a.id)`;

    expect(mismatches).toEqual([]);
  }

  it('creates the demo data once and changes nothing on the second run', async () => {
    await inRolledBackTransaction(prisma, async (transaction) => {
      await seedDemoData(transaction);
      const afterFirstRun = await countDemoRows(transaction);
      await seedDemoData(transaction);
      const afterSecondRun = await countDemoRows(transaction);

      expect(afterFirstRun).toEqual({
        customers: BigInt(DEMO_CUSTOMERS.length),
        accounts: BigInt(DEMO_CUSTOMERS.length),
        ledger: BigInt(DEMO_CUSTOMERS.reduce((sum, customer) => sum + customer.ledger.length, 0)),
      });
      expect(afterSecondRun).toEqual(afterFirstRun);
      await expectBalancesToMatchLedgers(transaction);
    });
  });

  it('does not reset a balance that has moved since the first run', async () => {
    await inRolledBackTransaction(prisma, async (transaction) => {
      await seedDemoData(transaction);
      await transaction.$executeRaw`
        UPDATE accounts SET balance_grosze = balance_grosze - 100 WHERE iban = ${DEMO_CUSTOMERS[0]?.iban}`;
      await seedDemoData(transaction);
      const rows = await transaction.$queryRaw<{ balance: bigint }[]>`
        SELECT balance_grosze AS balance FROM accounts WHERE iban = ${DEMO_CUSTOMERS[0]?.iban}`;

      expect(rows[0]?.balance).toBe(ANNA_BALANCE_GROSZE - 100n);
    });
  });

  it('works with the least-privilege application role (skipped where it does not exist)', async (context) => {
    await inRolledBackTransaction(prisma, async (transaction) => {
      if (!(await tryAssumeApplicationRole(transaction))) {
        context.skip();
      }
      await seedDemoData(transaction);
      await seedDemoData(transaction);
    });
  });
});
