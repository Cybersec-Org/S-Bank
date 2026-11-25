import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountsService } from './accounts.service.js';
import { CaslAbilityFactory } from '../auth/casl-ability.factory.js';
import { SignatureService } from '../auth/signature.service.js';
import { Role, type AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';

// Safety guard: integration tests must never run against the development database.
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || new URL(databaseUrl).pathname !== '/sbank_test') {
  throw new Error(
    'Integration tests require DATABASE_URL pointing to the sbank_test database.',
  );
}

describe('AccountsService transfer concurrency (PostgreSQL)', () => {
  const prisma = new PrismaService();
  const accountsService = new AccountsService(
    prisma,
    new CaslAbilityFactory(),
    new SignatureService(),
  );

  const customerIds: string[] = [];
  const accountIds: string[] = [];
  const transactionIds: string[] = [];

  const userFor = (id: string): AuthenticatedUser => ({
    id,
    role: Role.CLIENT,
    ipAddress: '127.0.0.1',
    acr: '1',
  });

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (transactionIds.length) {
      await prisma.transaction.deleteMany({
        where: { id: { in: [...transactionIds] } },
      });
      transactionIds.length = 0;
    }

    if (accountIds.length) {
      await prisma.account.deleteMany({
        where: { id: { in: [...accountIds] } },
      });
      accountIds.length = 0;
    }

    if (customerIds.length) {
      await prisma.customer.deleteMany({
        where: { id: { in: [...customerIds] } },
      });
      customerIds.length = 0;
    }
  });

  async function createFixture(balance: number) {
    const suffix = randomUUID();

    const customer = await prisma.customer.create({
      data: {
        id: `it-${suffix}`,
        firstName: 'Integration',
        lastName: 'Test',
        email: `${suffix}@integration.sbank.local`,
        customerNumber: `IT-${suffix}`,
      },
    });

    customerIds.push(customer.id);

    const sender = await prisma.account.create({
      data: {
        ownerId: customer.id,
        iban: `PLIT-S-${suffix}`,
        currency: 'PLN',
        balance,
        dailyLimit: 10000,
        status: 'ACTIVE',
      },
    });

    accountIds.push(sender.id);

    const receiver = await prisma.account.create({
      data: {
        ownerId: customer.id,
        iban: `PLIT-R-${suffix}`,
        currency: 'PLN',
        balance: 0,
        dailyLimit: 10000,
        status: 'ACTIVE',
      },
    });

    accountIds.push(receiver.id);

    return {
      customer,
      sender,
      receiver,
      user: userFor(customer.id),
    };
  }

  async function createDraft(
    senderId: string,
    receiverId: string,
    receiverIban: string,
    amount: number,
  ) {
    const draft = await prisma.transaction.create({
      data: {
        senderAccountId: senderId,
        receiverAccountId: receiverId,
        receiverIban,
        receiverName: 'Integration Receiver',
        amount,
        currency: 'PLN',
        title: 'Integration concurrency test',
        status: 'DRAFT',
      },
    });

    transactionIds.push(draft.id);
    return draft;
  }

  it('should execute the same draft only once when confirmed concurrently', async () => {
    const fixture = await createFixture(500);

    const draft = await createDraft(
      fixture.sender.id,
      fixture.receiver.id,
      fixture.receiver.iban,
      100,
    );

    const results = await Promise.allSettled([
      accountsService.confirmTransfer(draft.id, fixture.user),
      accountsService.confirmTransfer(draft.id, fixture.user),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);

    const [storedDraft, sender, receiver] = await Promise.all([
      prisma.transaction.findUniqueOrThrow({ where: { id: draft.id } }),
      prisma.account.findUniqueOrThrow({ where: { id: fixture.sender.id } }),
      prisma.account.findUniqueOrThrow({ where: { id: fixture.receiver.id } }),
    ]);

    expect(storedDraft.status).toBe('COMPLETED');
    expect(Number(sender.balance)).toBe(400);
    expect(Number(receiver.balance)).toBe(100);
  });

  it('should prevent concurrent drafts from spending more than the available balance', async () => {
    const fixture = await createFixture(100);

    const draft1 = await createDraft(
      fixture.sender.id,
      fixture.receiver.id,
      fixture.receiver.iban,
      80,
    );

    const draft2 = await createDraft(
      fixture.sender.id,
      fixture.receiver.id,
      fixture.receiver.iban,
      80,
    );

    const results = await Promise.allSettled([
      accountsService.confirmTransfer(draft1.id, fixture.user),
      accountsService.confirmTransfer(draft2.id, fixture.user),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);

    const [storedDraft1, storedDraft2, sender, receiver] = await Promise.all([
      prisma.transaction.findUniqueOrThrow({ where: { id: draft1.id } }),
      prisma.transaction.findUniqueOrThrow({ where: { id: draft2.id } }),
      prisma.account.findUniqueOrThrow({ where: { id: fixture.sender.id } }),
      prisma.account.findUniqueOrThrow({ where: { id: fixture.receiver.id } }),
    ]);

    expect(
      [storedDraft1.status, storedDraft2.status].filter(
        (status) => status === 'COMPLETED',
      ),
    ).toHaveLength(1);

    expect(Number(sender.balance)).toBe(20);
    expect(Number(receiver.balance)).toBe(80);
  });

  it('should allow only one operation when confirmation and cancellation race', async () => {
    const fixture = await createFixture(100);

    const draft = await createDraft(
      fixture.sender.id,
      fixture.receiver.id,
      fixture.receiver.iban,
      50,
    );

    const results = await Promise.allSettled([
      accountsService.confirmTransfer(draft.id, fixture.user),
      accountsService.cancelTransfer(draft.id, fixture.user),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);

    const [storedDraft, sender, receiver] = await Promise.all([
      prisma.transaction.findUniqueOrThrow({ where: { id: draft.id } }),
      prisma.account.findUniqueOrThrow({ where: { id: fixture.sender.id } }),
      prisma.account.findUniqueOrThrow({ where: { id: fixture.receiver.id } }),
    ]);

    if (storedDraft.status === 'COMPLETED') {
      expect(Number(sender.balance)).toBe(50);
      expect(Number(receiver.balance)).toBe(50);
    } else {
      expect(storedDraft.status).toBe('CANCELLED');
      expect(Number(sender.balance)).toBe(100);
      expect(Number(receiver.balance)).toBe(0);
    }
  });
  it('should prevent concurrent transfers from exceeding the daily limit', async () => {
    const fixture = await createFixture(500);

    await prisma.account.update({
      where: { id: fixture.sender.id },
      data: { dailyLimit: 100 },
    });

    const draft1 = await createDraft(
      fixture.sender.id,
      fixture.receiver.id,
      fixture.receiver.iban,
      60,
    );

    const draft2 = await createDraft(
      fixture.sender.id,
      fixture.receiver.id,
      fixture.receiver.iban,
      60,
    );

    const results = await Promise.allSettled([
      accountsService.confirmTransfer(draft1.id, fixture.user),
      accountsService.confirmTransfer(draft2.id, fixture.user),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);

    const [storedDraft1, storedDraft2, sender, receiver] = await Promise.all([
      prisma.transaction.findUniqueOrThrow({ where: { id: draft1.id } }),
      prisma.transaction.findUniqueOrThrow({ where: { id: draft2.id } }),
      prisma.account.findUniqueOrThrow({ where: { id: fixture.sender.id } }),
      prisma.account.findUniqueOrThrow({ where: { id: fixture.receiver.id } }),
    ]);

    expect(
      [storedDraft1.status, storedDraft2.status].filter(
        (status) => status === 'COMPLETED',
      ),
    ).toHaveLength(1);

    expect(Number(sender.balance)).toBe(440);
    expect(Number(receiver.balance)).toBe(60);
  });
  it('should handle concurrent transfers in opposite directions without deadlock', async () => {
    const fixture = await createFixture(100);

    await prisma.account.update({
      where: { id: fixture.receiver.id },
      data: { balance: 100 },
    });

    const draftAtoB = await createDraft(
      fixture.sender.id,
      fixture.receiver.id,
      fixture.receiver.iban,
      25,
    );

    const draftBtoA = await createDraft(
      fixture.receiver.id,
      fixture.sender.id,
      fixture.sender.iban,
      25,
    );

    const results = await Promise.allSettled([
      accountsService.confirmTransfer(draftAtoB.id, fixture.user),
      accountsService.confirmTransfer(draftBtoA.id, fixture.user),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);

    const [storedAtoB, storedBtoA, accountA, accountB] = await Promise.all([
      prisma.transaction.findUniqueOrThrow({ where: { id: draftAtoB.id } }),
      prisma.transaction.findUniqueOrThrow({ where: { id: draftBtoA.id } }),
      prisma.account.findUniqueOrThrow({ where: { id: fixture.sender.id } }),
      prisma.account.findUniqueOrThrow({ where: { id: fixture.receiver.id } }),
    ]);

    expect(storedAtoB.status).toBe('COMPLETED');
    expect(storedBtoA.status).toBe('COMPLETED');

    expect(Number(accountA.balance)).toBe(100);
    expect(Number(accountB.balance)).toBe(100);
  });
});
