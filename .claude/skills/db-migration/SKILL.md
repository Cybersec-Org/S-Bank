---
name: db-migration
description: Change the PostgreSQL schema through Prisma 7 migrations — model changes, constraints, indexes, grants and triggers, data migrations and seed updates — without editing committed migrations. Use whenever schema.prisma or the database structure must change.
argument-hint: '[snake_case_change_name] [what changes]'
---

# Database migration

Change: `$ARGUMENTS`

Follow `.claude/rules/database.md`.

## Steps

1. **Check state.** `pnpm run api:db:check-drift` must be clean before you start (stack running). If it is not, stop and report — someone changed the schema without a migration.
2. **Edit `schema.prisma`.** Naming via `@@map`/`@map`, BigInt grosze for money, explicit relations with deliberate `onDelete`, indexes for foreign keys and API filters, unique constraints for natural keys and idempotency keys.
3. **Generate without applying:** `pnpm run api:db:migrate:dev --name <snake_case_change> --create-only`.
4. **Review the SQL** in the new `prisma/migrations/<timestamp>_<name>/migration.sql`:
   - destructive or locking statements on existing tables → split into expand/contract migrations;
   - add what Prisma cannot express: `CHECK` constraints, partial indexes, `GRANT`/`REVOKE` for `sbank_app`, triggers (audit append-only), comments on sensitive columns.
5. **Apply:** `pnpm run api:db:migrate:dev` (applies the pending migration), then `pnpm run api:prisma:generate` (Prisma 7 does not generate automatically).
6. **Seed:** update `prisma/seed.ts` if new tables need demo data; keep it idempotent; run `pnpm run api:db:seed`.
7. **Repositories and types:** update repository functions and domain types; `pnpm run typecheck`.
8. **Tests:** e2e tests that rely on the new constraints (e.g. negative balance rejected by the DB, duplicate idempotency key → 409, audit `UPDATE` fails).
9. **Drift:** `pnpm run api:db:check-drift` is clean again.

## Never

- `prisma db push`, editing an applied/committed migration, renaming a migration folder, `$executeRawUnsafe`.
- Storing secrets, tokens or passwords; storing data the app does not need (data minimization, REQUIREMENTS §5).

## Hand-over notes

List the migration name, whether it is destructive, whether it needs a data backfill, and any manual step for existing environments.
