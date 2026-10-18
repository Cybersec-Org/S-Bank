import { PrismaPg } from '@prisma/adapter-pg';
import { loadRootEnvFile } from '../src/config/root-env-file.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { assertSeedAllowed, DEMO_CUSTOMERS, seedDemoData } from './seed-data.js';

/** Entry point of `prisma db seed` (see `migrations.seed` in prisma7.config.ts). */
async function main(): Promise<void> {
  // Load first: a root .env that sets NODE_ENV must be honoured by the production check.
  loadRootEnvFile();
  assertSeedAllowed(process.env['NODE_ENV']);

  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await prisma.$transaction((transaction) => seedDemoData(transaction));
    console.log(`Seeded ${DEMO_CUSTOMERS.length} demo customers (idempotent).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Seeding failed.');
  process.exitCode = 1;
});
