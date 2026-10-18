import { randomInt, randomUUID } from 'node:crypto';
import type { Prisma } from '../../src/generated/prisma/client.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';

export type TestTransaction = Prisma.TransactionClient;

/** The role the application connects as at runtime (created by infra/postgres/init). */
export const APPLICATION_ROLE = 'sbank_app';

class RollbackSignal extends Error {}

/**
 * Runs `work` in a transaction that is always rolled back. Tests leave no rows behind and need no
 * DELETE privilege, which matters because the application role has none on the ledger tables.
 * A failed statement aborts a PostgreSQL transaction, so a test puts one expected failure last.
 */
export async function inRolledBackTransaction(
  prisma: PrismaService,
  work: (transaction: TestTransaction) => Promise<void>,
): Promise<void> {
  try {
    await prisma.$transaction(async (transaction) => {
      await work(transaction);
      throw new RollbackSignal();
    });
  } catch (error) {
    if (!(error instanceof RollbackSignal)) {
      throw error;
    }
  }
}

/** Message plus Prisma metadata of a rejected statement; where the driver puts the text varies. */
export function describeDatabaseError(error: unknown): string {
  if (error instanceof Error) {
    const meta = 'meta' in error ? JSON.stringify(error.meta) : '';
    return `${error.message} ${meta}`;
  }
  return String(error);
}

/** Awaits `statement` and asserts that the database rejected it with a message matching `pattern`. */
export async function expectDatabaseRejection(
  statement: PromiseLike<unknown>,
  pattern: RegExp,
): Promise<void> {
  let rejection: unknown;
  try {
    await statement;
  } catch (error) {
    rejection = error;
  }
  if (rejection === undefined) {
    throw new Error(`Expected the database to reject the statement (${pattern.source}).`);
  }
  const description = describeDatabaseError(rejection);
  if (!pattern.test(description)) {
    throw new Error(`Rejected for another reason than ${pattern.source}: ${description}`);
  }
}

/** Shape-valid, random IBAN so concurrent or repeated runs never collide on the unique index. */
export function randomFakeIban(): string {
  const digits = Array.from({ length: 24 }, () => randomInt(10)).join('');
  return `PL00${digits}`;
}

export async function insertCustomer(transaction: TestTransaction): Promise<string> {
  const id = randomUUID();
  const subject = `test-subject-${id}`;
  await transaction.$executeRaw`
    INSERT INTO customers (id, subject, display_name)
    VALUES (${id}::uuid, ${subject}, 'Test Customer')`;
  return id;
}

export interface AccountOverrides {
  readonly balanceGrosze?: bigint;
  readonly dailyLimitGrosze?: bigint;
  readonly iban?: string;
  readonly currency?: string;
}

export async function insertAccount(
  transaction: TestTransaction,
  ownerId: string,
  overrides: AccountOverrides = {},
): Promise<string> {
  const id = randomUUID();
  await transaction.$executeRaw`
    INSERT INTO accounts (id, owner_id, iban, currency, balance_grosze, daily_limit_grosze)
    VALUES (
      ${id}::uuid,
      ${ownerId}::uuid,
      ${overrides.iban ?? randomFakeIban()},
      ${overrides.currency ?? 'PLN'},
      ${overrides.balanceGrosze ?? 0n},
      ${overrides.dailyLimitGrosze ?? 500000n}
    )`;
  return id;
}

export interface LedgerRowOverrides {
  readonly amountGrosze?: bigint;
  readonly counterpartyIban?: string;
}

export async function insertTransaction(
  transaction: TestTransaction,
  accountId: string,
  overrides: LedgerRowOverrides = {},
): Promise<string> {
  const id = randomUUID();
  await transaction.$executeRaw`
    INSERT INTO transactions (
      id, account_id, direction, amount_grosze, counterparty_iban, counterparty_name, title, booked_at
    )
    VALUES (
      ${id}::uuid,
      ${accountId}::uuid,
      'CREDIT'::transaction_direction,
      ${overrides.amountGrosze ?? 100n},
      ${overrides.counterpartyIban ?? randomFakeIban()},
      'Test Counterparty',
      'Test title',
      now()
    )`;
  return id;
}

/** True when the current database user owns the table, so no privilege check can fire first. */
export async function currentRoleOwnsTable(
  prisma: PrismaService,
  tableName: string,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ isOwner: boolean }[]>`
    SELECT pg_get_userbyid(relowner) = current_user AS "isOwner"
    FROM pg_class
    WHERE oid = to_regclass(${tableName})`;
  return rows[0]?.isOwner ?? false;
}

/**
 * Locally the role may be missing (plain database), so role-specific checks are skipped. In CI the
 * workflow creates the role, and a skip there would silently drop the only proof of the least-privilege
 * grants (SR-14), so it fails instead.
 */
function applicationRoleUnavailable(reason: string): false {
  if (process.env['CI'] === 'true') {
    throw new Error(`${APPLICATION_ROLE} is required in CI: ${reason}`);
  }
  return false;
}

/**
 * Switches the current transaction to the application role. Returns false when that role does not
 * exist or cannot be assumed (local single-role database), so the caller can skip role-specific checks.
 */
export async function tryAssumeApplicationRole(transaction: TestTransaction): Promise<boolean> {
  const roles = await transaction.$queryRaw<{ present: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${APPLICATION_ROLE}) AS present`;
  if (!roles[0]?.present) {
    return applicationRoleUnavailable('the role does not exist');
  }
  try {
    await transaction.$executeRaw`SAVEPOINT assume_application_role`;
    await transaction.$executeRaw`SET LOCAL ROLE sbank_app`;
    return true;
  } catch {
    await transaction.$executeRaw`ROLLBACK TO SAVEPOINT assume_application_role`;
    return applicationRoleUnavailable('the connecting role cannot assume it');
  }
}
