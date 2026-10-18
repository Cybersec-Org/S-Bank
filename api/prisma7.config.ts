import { defineConfig } from 'prisma/config';
import { loadRootEnvFile } from './src/config/root-env-file.js';

// Prisma 7 does not read dotenv files on its own, so the repository-root file is loaded explicitly.
loadRootEnvFile();

// Prisma 8 uses a different config format; 7.x looks for `prisma7.config.*` first.
// DATABASE_URL is read without env(): `prisma generate` and `prisma validate` must work offline
// (CI, Docker build), while migrate/seed commands fail loudly when the datasource URL is missing.
// db:check-drift diffs the migrated live database against schema.prisma (--from-config-datasource)
// because CI has no shadow database and runs it right after `migrate deploy`; --exit-code makes
// differences (exit 2) and errors (exit 1) both fail the job.
const databaseUrl = process.env['DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: databaseUrl ? { url: databaseUrl } : {},
});
