import type { Prisma } from '../src/generated/prisma/client.js';
import type { TransactionDirection } from '../src/generated/prisma/enums.js';

/** The slice of a Prisma client (or transaction client) the seed needs. */
export type SeedClient = Pick<Prisma.TransactionClient, 'customer' | 'account' | 'transaction'>;

export interface SeedLedgerEntry {
  /** Fixed id: re-running the seed must not duplicate ledger rows. */
  readonly id: string;
  readonly direction: TransactionDirection;
  readonly amountGrosze: bigint;
  readonly counterpartyIban: string;
  readonly counterpartyName: string;
  readonly title: string;
  readonly bookedAt: Date;
}

export interface SeedCustomer {
  /** Placeholder, deliberately not a Keycloak id: B-09 creates real customers on first login. */
  readonly subject: string;
  readonly displayName: string;
  readonly iban: string;
  readonly ledger: readonly SeedLedgerEntry[];
}

/**
 * Valid (mod-97) but obviously fake Polish IBANs in the made-up bank range 1234 5678, aligned with
 * FAKE_IBANS in the app's mock data (app/src/shared/api/mock/mock-data.ts).
 */
export const SEED_IBANS = {
  openingBalanceSource: 'PL26123456780000000000000000',
  annaTestowa: 'PL96123456780000000000000001',
  janPrzykladowy: 'PL42123456780000000000000003',
  annaEmployer: 'PL15123456780000000000000004',
  shop: 'PL04123456780000000000000008',
  annaLandlord: 'PL74123456780000000000000009',
  gym: 'PL47123456780000000000000010',
  janEmployer: 'PL20123456780000000000000011',
  janLandlord: 'PL90123456780000000000000012',
} as const;

const OPENING_BALANCE_SOURCE_NAME = 'Saldo początkowe (dane demonstracyjne)';
const OPENING_BALANCE_TITLE = 'Saldo początkowe konta demonstracyjnego';

/** Deterministic, obviously synthetic UUIDs (version 4 shape) for the seeded ledger rows. */
function seedTransactionId(sequence: number): string {
  return `5eed0000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

/**
 * Ledger rule: every account's balance equals the sum of its seeded rows, CREDIT minus DEBIT, and
 * the first row of each account is an opening-balance CREDIT. The seed derives the stored balance
 * from the ledger, so the two cannot disagree.
 */
export const DEMO_CUSTOMERS: readonly SeedCustomer[] = [
  {
    subject: 'seed-subject-anna-testowa',
    displayName: 'Anna Testowa',
    iban: SEED_IBANS.annaTestowa,
    ledger: [
      {
        id: seedTransactionId(1),
        direction: 'CREDIT',
        amountGrosze: 620_000n,
        counterpartyIban: SEED_IBANS.openingBalanceSource,
        counterpartyName: OPENING_BALANCE_SOURCE_NAME,
        title: OPENING_BALANCE_TITLE,
        bookedAt: new Date('2026-08-31T08:00:00.000Z'),
      },
      {
        id: seedTransactionId(2),
        direction: 'CREDIT',
        amountGrosze: 450_000n,
        counterpartyIban: SEED_IBANS.annaEmployer,
        counterpartyName: 'Przykładowa Firma Sp. z o.o.',
        title: 'Wynagrodzenie za wrzesień 2026',
        bookedAt: new Date('2026-09-01T06:15:00.000Z'),
      },
      {
        id: seedTransactionId(3),
        direction: 'DEBIT',
        amountGrosze: 150_000n,
        counterpartyIban: SEED_IBANS.annaLandlord,
        counterpartyName: 'Wynajem Testowy Sp. z o.o.',
        title: 'Czynsz za wrzesień 2026',
        bookedAt: new Date('2026-09-05T09:40:00.000Z'),
      },
      {
        id: seedTransactionId(4),
        direction: 'DEBIT',
        amountGrosze: 50_000n,
        counterpartyIban: SEED_IBANS.janPrzykladowy,
        counterpartyName: 'Jan Przykładowy',
        title: 'Zwrot za wspólny obiad',
        bookedAt: new Date('2026-09-20T17:05:00.000Z'),
      },
      {
        id: seedTransactionId(5),
        direction: 'CREDIT',
        amountGrosze: 450_000n,
        counterpartyIban: SEED_IBANS.annaEmployer,
        counterpartyName: 'Przykładowa Firma Sp. z o.o.',
        title: 'Wynagrodzenie za październik 2026',
        bookedAt: new Date('2026-10-01T06:15:00.000Z'),
      },
      {
        id: seedTransactionId(6),
        direction: 'DEBIT',
        amountGrosze: 70_000n,
        counterpartyIban: SEED_IBANS.shop,
        counterpartyName: 'Sklep Przykładowy',
        title: 'Zakupy spożywcze',
        bookedAt: new Date('2026-10-09T15:22:00.000Z'),
      },
    ],
  },
  {
    subject: 'seed-subject-jan-przykladowy',
    displayName: 'Jan Przykładowy',
    iban: SEED_IBANS.janPrzykladowy,
    ledger: [
      {
        id: seedTransactionId(11),
        direction: 'CREDIT',
        amountGrosze: 200_000n,
        counterpartyIban: SEED_IBANS.openingBalanceSource,
        counterpartyName: OPENING_BALANCE_SOURCE_NAME,
        title: OPENING_BALANCE_TITLE,
        bookedAt: new Date('2026-08-31T08:00:00.000Z'),
      },
      {
        id: seedTransactionId(12),
        direction: 'CREDIT',
        amountGrosze: 380_000n,
        counterpartyIban: SEED_IBANS.janEmployer,
        counterpartyName: 'Biuro Testowe Sp. z o.o.',
        title: 'Wynagrodzenie za wrzesień 2026',
        bookedAt: new Date('2026-09-02T07:00:00.000Z'),
      },
      {
        id: seedTransactionId(13),
        direction: 'DEBIT',
        amountGrosze: 250_000n,
        counterpartyIban: SEED_IBANS.janLandlord,
        counterpartyName: 'Kamienica Przykładowa Sp. z o.o.',
        title: 'Czynsz za wrzesień 2026',
        bookedAt: new Date('2026-09-06T10:10:00.000Z'),
      },
      {
        id: seedTransactionId(14),
        direction: 'CREDIT',
        amountGrosze: 50_000n,
        counterpartyIban: SEED_IBANS.annaTestowa,
        counterpartyName: 'Anna Testowa',
        title: 'Zwrot za wspólny obiad',
        bookedAt: new Date('2026-09-20T17:05:00.000Z'),
      },
      {
        id: seedTransactionId(15),
        direction: 'DEBIT',
        amountGrosze: 15_000n,
        counterpartyIban: SEED_IBANS.gym,
        counterpartyName: 'Siłownia Testowa',
        title: 'Karnet na siłownię',
        bookedAt: new Date('2026-09-25T18:30:00.000Z'),
      },
      {
        id: seedTransactionId(16),
        direction: 'DEBIT',
        amountGrosze: 45_000n,
        counterpartyIban: SEED_IBANS.shop,
        counterpartyName: 'Sklep Przykładowy',
        title: 'Zakupy spożywcze',
        bookedAt: new Date('2026-10-03T12:45:00.000Z'),
      },
    ],
  },
];

/** CREDIT rows add to the balance, DEBIT rows subtract from it. */
export function calculateLedgerBalanceGrosze(ledger: readonly SeedLedgerEntry[]): bigint {
  return ledger.reduce(
    (balance, entry) =>
      entry.direction === 'CREDIT' ? balance + entry.amountGrosze : balance - entry.amountGrosze,
    0n,
  );
}

/** Demo data must never reach a production database. */
export function assertSeedAllowed(nodeEnv: string | undefined): void {
  if (nodeEnv === 'production') {
    throw new Error('Refusing to seed demo data: NODE_ENV is "production".');
  }
}

/**
 * Creates the demo customers, accounts and ledger. Idempotent: customers and accounts are upserted
 * by their natural keys (an existing account keeps its current balance) and ledger rows have fixed
 * ids, so a second run changes nothing. Run it inside a transaction so a partial seed cannot leave
 * a balance that disagrees with its ledger.
 */
export async function seedDemoData(client: SeedClient): Promise<void> {
  for (const demo of DEMO_CUSTOMERS) {
    const customer = await client.customer.upsert({
      where: { subject: demo.subject },
      create: { subject: demo.subject, displayName: demo.displayName },
      update: { displayName: demo.displayName },
      select: { id: true },
    });
    const account = await client.account.upsert({
      where: { iban: demo.iban },
      create: {
        ownerId: customer.id,
        iban: demo.iban,
        balanceGrosze: calculateLedgerBalanceGrosze(demo.ledger),
      },
      update: {},
      select: { id: true },
    });
    await client.transaction.createMany({
      data: demo.ledger.map((entry) => ({ ...entry, accountId: account.id })),
      skipDuplicates: true,
    });
  }
}
