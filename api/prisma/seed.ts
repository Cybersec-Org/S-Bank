import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning database...');
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.customer.deleteMany();

  console.log('Creating customers...');
  await prisma.customer.create({
    data: {
      id: 'client-1',
      firstName: 'Jan',
      lastName: 'Kowalski',
      email: 'jan.kowalski@example.com',
      customerNumber: 'CUST-1001',
    },
  });

  await prisma.customer.create({
    data: {
      id: 'client-2',
      firstName: 'Anna',
      lastName: 'Nowak',
      email: 'anna.nowak@example.com',
      customerNumber: 'CUST-1002',
    },
  });

  console.log('Creating bank accounts...');
  const acc1 = await prisma.account.create({
    data: {
      iban: 'PL11102010260000140202736451',
      ownerId: 'client-1',
      currency: 'PLN',
      balance: 5000.00,
      dailyLimit: 2000.00,
      status: 'ACTIVE',
    },
  });

  await prisma.account.create({
    data: {
      iban: 'PL22102010260000140202736452',
      ownerId: 'client-1',
      currency: 'EUR',
      balance: 1200.50,
      dailyLimit: 500.00,
      status: 'ACTIVE',
    },
  });

  const acc2 = await prisma.account.create({
    data: {
      iban: 'PL99102010260000140202736451',
      ownerId: 'client-2',
      currency: 'PLN',
      balance: 1500.00,
      dailyLimit: 1000.00,
      status: 'ACTIVE',
    },
  });

  console.log('Creating initial transaction...');
  await prisma.transaction.create({
    data: {
      operationNumber: 'OP-SEED-001',
      senderAccountId: acc1.id,
      receiverAccountId: acc2.id,
      receiverIban: acc2.iban,
      receiverName: 'Anna Nowak',
      amount: 250.00,
      currency: 'PLN',
      title: 'Initial seed transfer',
      status: 'COMPLETED',
      executedAt: new Date(),
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });