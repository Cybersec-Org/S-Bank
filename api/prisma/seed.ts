import { PrismaClient, AccountStatus, TransactionType, TransactionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing database records...');
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();

  console.log('Creating test bank accounts...');

  const accountClient1Pln = await prisma.account.create({
    data: {
      iban: 'PL61109010140000071219812874',
      ownerId: 'client-1',
      name: 'Personal Account PLN',
      currency: 'PLN',
      balance: 12500.50,
      dailyLimit: 5000.00,
      status: AccountStatus.ACTIVE,
    },
  });

  const accountClient1Eur = await prisma.account.create({
    data: {
      iban: 'PL27114020040000300201355387',
      ownerId: 'client-1',
      name: 'Foreign Currency Account EUR',
      currency: 'EUR',
      balance: 850.00,
      dailyLimit: 1000.00,
      status: AccountStatus.ACTIVE,
    },
  });

  const accountClient2Pln = await prisma.account.create({
    data: {
      iban: 'PL83102010260000140202736451',
      ownerId: 'client-2',
      name: 'Personal Account (John Smith)',
      currency: 'PLN',
      balance: 4200.00,
      dailyLimit: 3000.00,
      status: AccountStatus.ACTIVE,
    },
  });

  console.log('Creating sample transactions...');

  await prisma.transaction.create({
    data: {
      receiverAccountId: accountClient1Pln.id,
      senderIban: 'PL00101000000000000000000000',
      receiverIban: accountClient1Pln.iban,
      receiverName: 'John Doe',
      amount: 8500.00,
      currency: 'PLN',
      title: 'Monthly Salary - October',
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
    },
  });

  await prisma.transaction.create({
    data: {
      senderAccountId: accountClient1Pln.id,
      receiverAccountId: accountClient2Pln.id,
      senderIban: accountClient1Pln.iban,
      receiverIban: accountClient2Pln.iban,
      receiverName: 'John Smith',
      amount: 2100.00,
      currency: 'PLN',
      title: 'Apartment Rent',
      type: TransactionType.INTERNAL_TRANSFER,
      status: TransactionStatus.COMPLETED,
    },
  });

  await prisma.transaction.create({
    data: {
      senderAccountId: accountClient2Pln.id,
      receiverAccountId: accountClient1Pln.id,
      senderIban: accountClient2Pln.iban,
      receiverIban: accountClient1Pln.iban,
      receiverName: 'John Doe',
      amount: 65.50,
      currency: 'PLN',
      title: 'Dinner split refund',
      type: TransactionType.INTERNAL_TRANSFER,
      status: TransactionStatus.COMPLETED,
    },
  });

  console.log('Creating sample audit log entry...');
  await prisma.auditLog.create({
    data: {
      actorId: 'client-1',
      actorRole: 'CLIENT',
      action: 'TRANSFER_CREATE',
      resourceId: accountClient1Pln.id,
      details: JSON.stringify({ amount: 2100.00, to: accountClient2Pln.iban }),
      ipAddress: '127.0.0.1',
    },
  });

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Database seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });