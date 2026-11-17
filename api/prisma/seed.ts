import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning database...');
  await prisma.auditLog.deleteMany();
  await prisma.paymentRequest.deleteMany();
  await prisma.recipient.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.systemConfig.deleteMany();

  console.log('Creating system config...');
  await prisma.systemConfig.create({
    data: {
      id: 'global',
      stepUpThreshold: 1000.00,
      minDailyLimit: 100.00,
      maxDailyLimit: 50000.00,
    },
  });

  console.log('Creating customers...');
  await prisma.customer.createMany({
    data: [
      {
        id: 'client-1',
        firstName: 'Jan',
        lastName: 'Kowalski',
        email: 'jan.kowalski@sbank.pl',
        customerNumber: 'CUST-1001',
      },
      {
        id: 'client-2',
        firstName: 'Anna',
        lastName: 'Nowak',
        email: 'anna.nowak@sbank.pl',
        customerNumber: 'CUST-1002',
      },
      {
        id: 'client-3',
        firstName: 'Piotr',
        lastName: 'Wiśniewski',
        email: 'piotr.wisniewski@sbank.pl',
        customerNumber: 'CUST-1003',
      },
    ],
  });

  console.log('Creating bank accounts...');
  const acc1Pln = await prisma.account.create({
    data: {
      iban: 'PL11102010260000140202736451',
      ownerId: 'client-1',
      currency: 'PLN',
      balance: 12500.00,
      dailyLimit: 5000.00,
      status: 'ACTIVE',
    },
  });

  await prisma.account.create({
    data: {
      iban: 'PL22102010260000140202736452',
      ownerId: 'client-1',
      currency: 'EUR',
      balance: 1850.50,
      dailyLimit: 2000.00,
      status: 'ACTIVE',
    },
  });

  const acc2Pln = await prisma.account.create({
    data: {
      iban: 'PL99102010260000140202736451',
      ownerId: 'client-2',
      currency: 'PLN',
      balance: 4200.00,
      dailyLimit: 5000.00,
      status: 'ACTIVE',
    },
  });

  await prisma.account.create({
    data: {
      iban: 'PL55102010260000140202736499',
      ownerId: 'client-3',
      currency: 'PLN',
      balance: 900.00,
      dailyLimit: 1000.00,
      status: 'FROZEN',
    },
  });

  console.log('Creating saved recipients...');
  await prisma.recipient.createMany({
    data: [
      {
        ownerId: 'client-1',
        name: 'Anna Nowak (Czynsz)',
        iban: acc2Pln.iban,
      },
      {
        ownerId: 'client-2',
        name: 'Jan Kowalski',
        iban: acc1Pln.iban,
      },
    ],
  });

  console.log('Creating demo QR / Partner payment request...');
  await prisma.paymentRequest.create({
    data: {
      id: 'pay-req-demo-1',
      partnerId: 'partner1',
      receiverIban: acc2Pln.iban,
      receiverName: 'Sklep Partner1 Sp. z o.o.',
      amount: 149.99,
      currency: 'PLN',
      title: 'Zamówienie #SB-2026-99 (płatność QR / deep link)',
      status: 'PENDING',
    },
  });

  console.log('Creating initial transactions...');
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.transaction.create({
    data: {
      operationNumber: 'OP-SEED-001',
      senderAccountId: acc1Pln.id,
      receiverAccountId: acc2Pln.id,
      receiverIban: acc2Pln.iban,
      receiverName: 'Anna Nowak',
      amount: 250.00,
      currency: 'PLN',
      title: 'Zwrot za obiad',
      status: 'COMPLETED',
      createdAt: yesterday,
      executedAt: yesterday,
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