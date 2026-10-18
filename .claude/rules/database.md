---
paths:
  - 'api/prisma/**'
  - 'api/prisma*.config.ts'
  - 'api/src/**/*.repository.ts'
---

# Database rules (PostgreSQL + Prisma 7)

- Prisma stays on major 7 (`prisma@7`, `@prisma/client@7`, `@prisma/adapter-pg@7`). `npm latest` is a Prisma 8 pre-release — do not install it.
- Prisma 7 specifics: generator `prisma-client` with an explicit `output` inside `src/generated/prisma` (git-ignored), driver adapter `PrismaPg` is mandatory, env vars are not loaded automatically (the config file loads `.env`), `migrate dev` no longer runs `generate` or seed — run them explicitly.
- Schema changes only through migrations: `pnpm run api:db:migrate:dev --name <snake_case_change>` (use `--create-only` when the SQL needs manual additions). Never `prisma db push`. Never edit a committed migration.
- Review generated SQL before applying: destructive statements (`DROP`, type narrowing, `NOT NULL` without default on populated tables) need an expand → migrate data → contract sequence and an ADR if data is lost.
- Naming: models `PascalCase` singular, mapped to `snake_case` plural tables (`@@map("accounts")`), columns `snake_case` via `@map`. Primary keys UUID. Every table has `created_at`; mutable tables have `updated_at`.
- Money: integer grosze in `BigInt` columns (`balance_grosze`, `amount_grosze`), plus `CHECK` constraints added in migration SQL (`balance_grosze >= 0`, `amount_grosze > 0`). Convert to `number` only at the API boundary after `Number.isSafeInteger`.
- IBANs stored normalized (uppercase, no spaces) with a unique index where applicable.
- Foreign keys always declared; choose `onDelete` deliberately (financial history is never cascaded away — use `Restrict`).
- Indexes for every foreign key and every filter used by the API (owner id, created_at for history).
- Concurrency: balance and limit checks use `SELECT … FOR UPDATE` through tagged `$queryRaw` inside `$transaction`; idempotency keys have a unique constraint `(owner_id, key)`.
- Audit table `audit_log` is append-only: the migration revokes `UPDATE`, `DELETE`, `TRUNCATE` from the application role and adds a trigger that raises on update/delete. Rows hold who/what/when/ip/acr — never tokens, passwords or full card data.
- The application connects with a least-privilege role (no superuser, no DDL at runtime); migrations run with the migration role.
- Raw SQL only via tagged templates (`$queryRaw\`…${value}\``) or `Prisma.sql`; `$queryRawUnsafe`/`$executeRawUnsafe` are forbidden.
- Seed (`prisma/seed.ts`) creates only demo data with obviously fake names and IBANs from a test range; it is idempotent.
