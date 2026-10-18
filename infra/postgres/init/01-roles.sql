-- First-start initialisation of the application database (SR-14, least privilege).
--
-- The official postgres image runs this file once, as the superuser POSTGRES_USER, against the database
-- POSTGRES_DB, and only when the data directory is empty (see infra/README.md for how to re-run it).
-- psql reads the passwords from its own environment (\getenv), so they appear neither in this file nor
-- in a process argument list, and :'name' quotes them as SQL literals. Nothing here prints a password.
--
--   sbank_migrator  owns the schema and every table (DDL). Used only by the one-off `migrate` service.
--   sbank_app       used by the API at run time. No DDL; table privileges come from the Prisma
--                   migrations (explicit GRANTs there, no ALTER DEFAULT PRIVILEGES).
--   POSTGRES_USER   superuser for administration; no application connects with it.

\getenv database_name POSTGRES_DB
\getenv migrator_password POSTGRES_MIGRATOR_PASSWORD
\getenv app_password POSTGRES_APP_PASSWORD

CREATE ROLE sbank_migrator LOGIN PASSWORD :'migrator_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

CREATE ROLE sbank_app LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

-- A missing or empty variable would silently create a role without a password; fail instead.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_authid
    WHERE rolname IN ('sbank_migrator', 'sbank_app') AND rolpassword IS NULL
  ) THEN
    RAISE EXCEPTION 'POSTGRES_MIGRATOR_PASSWORD and POSTGRES_APP_PASSWORD must be set and non-empty';
  END IF;
END
$$;

-- Nobody connects by default. CREATE on the database lets the migrator run Prisma's own
-- `CREATE SCHEMA IF NOT EXISTS "public"`: PostgreSQL checks that privilege before it notices the schema exists.
REVOKE ALL ON DATABASE :"database_name" FROM PUBLIC;
GRANT CONNECT, CREATE ON DATABASE :"database_name" TO sbank_migrator;
GRANT CONNECT ON DATABASE :"database_name" TO sbank_app;

-- The migrator owns schema public, so every table it creates is owned by it and the application role
-- gets only what the migrations grant. No other role (PUBLIC) may create objects or even look up names there;
-- sbank_app receives USAGE from the first migration.
ALTER SCHEMA public OWNER TO sbank_migrator;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
