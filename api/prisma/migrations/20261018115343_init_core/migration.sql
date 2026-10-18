-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "transaction_direction" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subject" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "iban" VARCHAR(34) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'PLN',
    "balance_grosze" BIGINT NOT NULL,
    "daily_limit_grosze" BIGINT NOT NULL DEFAULT 500000,
    "status" "account_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "direction" "transaction_direction" NOT NULL,
    "amount_grosze" BIGINT NOT NULL,
    "counterparty_iban" VARCHAR(34) NOT NULL,
    "counterparty_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "booked_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "ip" VARCHAR(45),
    "acr" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_subject_key" ON "customers"("subject");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_iban_key" ON "accounts"("iban");

-- CreateIndex
CREATE INDEX "accounts_owner_id_idx" ON "accounts"("owner_id");

-- CreateIndex
CREATE INDEX "transactions_account_id_booked_at_idx" ON "transactions"("account_id", "booked_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_occurred_at_idx" ON "audit_log"("occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- ======================================================================================
-- Hardening that Prisma cannot express. Everything below is part of this migration on purpose:
-- the database is the last line of defence if application code is wrong (SR-05, SR-07, SR-14).
-- ======================================================================================

-- --------------------------------------------------------------------------------------
-- 1. CHECK constraints (unconditional, apply in every environment)
-- --------------------------------------------------------------------------------------

-- Money is integer grosze. A balance can never go negative, even if a service forgets to check.
ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_balance_grosze_non_negative" CHECK ("balance_grosze" >= 0);

-- A ledger row always moves a positive amount; the direction column carries the sign.
ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_amount_grosze_positive" CHECK ("amount_grosze" > 0);

-- Daily limit: 0 to 50 000 zł. The upper bound mirrors MAX_DAILY_LIMIT_GROSZE in
-- api/src/config/defaults.ts - change both together (the default of 500000 is 5 000 zł).
ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_daily_limit_grosze_in_range"
    CHECK ("daily_limit_grosze" BETWEEN 0 AND 5000000);

-- IBANs are stored normalized (uppercase, no spaces; 15-34 characters). The regular expression
-- checks the shape only; the mod-97 checksum is validated by the API before anything is stored.
ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_iban_normalized"
    CHECK ("iban" ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$');

ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_counterparty_iban_normalized"
    CHECK ("counterparty_iban" ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$');

-- ISO 4217 shape (three uppercase letters); CHAR(3) alone would accept "pl " or "123".
ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_currency_iso_4217_shape" CHECK ("currency" ~ '^[A-Z]{3}$');

-- --------------------------------------------------------------------------------------
-- 2. Audit log is append-only (SR-14): trigger, unconditional and independent of any role
-- --------------------------------------------------------------------------------------

-- One statement-level trigger rejects UPDATE, DELETE and TRUNCATE. Statement level (not per row)
-- so that even a statement matching zero rows is refused, and so that TRUNCATE is covered by the
-- same function. It raises for every role, including the table owner; this is what makes the
-- immutability test pass in CI, where only one database role exists.
CREATE FUNCTION "audit_log_reject_modification"() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only: % is not allowed', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

-- The function is only ever run by the trigger; nobody needs to call it directly.
REVOKE ALL ON FUNCTION "audit_log_reject_modification"() FROM PUBLIC;

CREATE TRIGGER "audit_log_append_only"
    BEFORE UPDATE OR DELETE OR TRUNCATE ON "audit_log"
    FOR EACH STATEMENT
    EXECUTE FUNCTION "audit_log_reject_modification"();

-- ENABLE ALWAYS keeps the trigger firing even when a superuser sets
-- session_replication_role = replica (the setting that normally bypasses triggers).
-- A superuser or the table owner can still DROP the trigger; that is a DDL action which only the
-- migration role may perform and which shows up in migration review.
ALTER TABLE "audit_log" ENABLE ALWAYS TRIGGER "audit_log_append_only";

-- --------------------------------------------------------------------------------------
-- 3. Least-privilege grants for the application role (conditional)
-- --------------------------------------------------------------------------------------

-- The roles sbank_migrator (owns the tables, runs migrations) and sbank_app (the API at runtime)
-- are created by infra/postgres/init/*.sql, not here. CI and plain local databases have a single
-- owner role, so every GRANT/REVOKE for sbank_app sits behind a pg_roles check and the migration
-- applies unchanged in both setups. Nothing is ever granted to PUBLIC.
--
-- ALTER DEFAULT PRIVILEGES is deliberately NOT used: every future table needs an explicit GRANT
-- in the migration that creates it, so no table becomes writable by the application by accident.
-- There are no sequences (primary keys are UUIDs from gen_random_uuid()), so no sequence grants.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sbank_app') THEN
        GRANT USAGE ON SCHEMA public TO sbank_app;

        -- Customers and accounts are mutable (profile, balance, limit, status). Rows are never
        -- deleted by the application: financial history is kept (foreign keys use RESTRICT).
        GRANT SELECT, INSERT, UPDATE ON TABLE "customers" TO sbank_app;
        GRANT SELECT, INSERT, UPDATE ON TABLE "accounts" TO sbank_app;

        -- Ledger rows are written once and never edited or removed; corrections are new rows.
        GRANT SELECT, INSERT ON TABLE "transactions" TO sbank_app;

        -- Audit log: INSERT only. SELECT is NOT granted for now; the admin view of the log (B-29)
        -- must add its read path through a dedicated, reviewed decision (separate role or view).
        -- REVOKE ALL first so nothing inherited or granted earlier survives, in particular
        -- UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER.
        REVOKE ALL ON TABLE "audit_log" FROM sbank_app;
        GRANT INSERT ON TABLE "audit_log" TO sbank_app;
    END IF;
END
$$;
