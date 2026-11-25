
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  console.log('Creating demo customers...');

  await prisma.customer.upsert({
    where: { id: 'client-1' },
    update: {},
    create: {
      id: 'client-1',
      firstName: 'Jan',
      lastName: 'Kowalski',
      email: 'jan.kowalski@example.com',
      customerNumber: 'CUST-1001',
    },
  });

  await prisma.customer.upsert({
    where: { id: 'client-2' },
    update: {},
    create: {
      id: 'client-2',
      firstName: 'Anna',
      lastName: 'Nowak',
      email: 'anna.nowak@example.com',
      customerNumber: 'CUST-1002',
    },
  });

<<<<<<< HEAD
  console.log('Creating bank accounts...');
  const acc1 = await prisma.account.create({
    data: {
      iban: 'PL04102010260000140202736451',
=======
  console.log('Creating demo bank accounts...');

  const acc1 = await prisma.account.upsert({
    where: { iban: 'PL11102010260000140202736451' },
    update: {},
    create: {
      iban: 'PL11102010260000140202736451',
>>>>>>> origin/passkeys-and-stepup
      ownerId: 'client-1',
      currency: 'PLN',
      balance: 12500.00,
      dailyLimit: 5000.00,
      status: 'ACTIVE',
    },
  });

  const acc1Eur = await prisma.account.upsert({
    where: { iban: 'PL22102010260000140202736452' },
    update: {},
    create: {
      iban: 'PL22102010260000140202736452',
      ownerId: 'client-1',
      currency: 'EUR',
      balance: 1850.50,
      dailyLimit: 2000.00,
      status: 'ACTIVE',
    },
  });

<<<<<<< HEAD
  await prisma.account.create({
    data: {
      iban: 'PL74102010260000140202736452',
      ownerId: 'client-1',
      currency: 'EUR',
      balance: 1200.50,
      dailyLimit: 500.00,
      status: 'ACTIVE',
    },
  });

  const acc2 = await prisma.account.create({
    data: {
      iban: 'PL47102010260000140202736453',
=======
  const acc2 = await prisma.account.upsert({
    where: { iban: 'PL99102010260000140202736451' },
    update: {},
    create: {
      iban: 'PL99102010260000140202736451',
>>>>>>> origin/passkeys-and-stepup
      ownerId: 'client-2',
      currency: 'PLN',
      balance: 4200.00,
      dailyLimit: 5000.00,
      status: 'ACTIVE',
    },
  });

  console.log('Creating initial transaction...');

  await prisma.transaction.upsert({
    where: { operationNumber: 'OP-SEED-001' },
    update: {},
    create: {
      operationNumber: 'OP-SEED-001',
      senderAccountId: acc1.id,
      receiverAccountId: acc2.id,
      receiverIban: acc2.iban,
      receiverName: 'Anna Nowak',
      amount: 250.00,
      currency: 'PLN',
      title: 'Zwrot za obiad',
      status: 'COMPLETED',
      createdAt: yesterday,
      executedAt: yesterday,
    },
  });

  console.log('Creating Keycloak integration...');
  await prisma.customer.upsert({
    where: { id: 'client-1' },
    update: {
      keycloakSub: 'c8df368e-a7d3-45d7-a5d6-f1e9ab242ab6',
    },
    create: {
      id: 'client-1',
      keycloakSub: 'c8df368e-a7d3-45d7-a5d6-f1e9ab242ab6',
      firstName: 'Jan',
      lastName: 'Kowalski',
      email: 'jan.kowalski@example.com',
      customerNumber: 'CUST-1001',
    },
  });

  console.log('Creating system configuration...');

  await prisma.systemConfig.upsert({
    where: { id: 'global' },
    update: {},
    create: {
      id: 'global',
      stepUpThreshold: 1000,
      minDailyLimit: 100,
      maxDailyLimit: 50000,
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

