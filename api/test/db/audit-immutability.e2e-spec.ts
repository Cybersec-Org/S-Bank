import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../src/audit/audit.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, type TestApp } from '../helpers/create-test-app.js';
import {
  APPLICATION_ROLE,
  currentRoleOwnsTable,
  expectDatabaseRejection,
  inRolledBackTransaction,
  tryAssumeApplicationRole,
} from '../helpers/database.js';

/** Raised by the `audit_log_append_only` trigger for every role, including the table owner. */
const TRIGGER_REJECTION = /audit_log is append-only/;

describe('audit_log is append-only (SR-14)', () => {
  let testApp: TestApp;
  let prisma: PrismaService;
  /** Pattern a rejected statement must match: the trigger text unless a missing privilege stops it first. */
  let rejection: RegExp;
  let committedRowId: string;

  beforeAll(async () => {
    testApp = await createTestApp({ useDatabase: true });
    prisma = testApp.app.get(PrismaService);

    // CI connects as the table owner, where only the trigger can refuse. When the suite runs as the
    // application role, the missing privilege may refuse first; either way the statement fails.
    const owner = await currentRoleOwnsTable(prisma, 'audit_log');
    rejection = owner ? TRIGGER_REJECTION : /audit_log is append-only|permission denied/;

    // The one row these tests leave behind: the audit log cannot be cleaned up, by design.
    committedRowId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO audit_log (id, actor_id, actor_role, action, resource_type)
      VALUES (${committedRowId}::uuid, 'test-actor', 'admin', ${`test.audit-immutability.${committedRowId}`}, 'test')`;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('rejects UPDATE of a committed row', async () => {
    await expectDatabaseRejection(
      prisma.$executeRaw`UPDATE audit_log SET action = 'tampered' WHERE id = ${committedRowId}::uuid`,
      rejection,
    );
  });

  it('rejects DELETE of a committed row', async () => {
    await expectDatabaseRejection(
      prisma.$executeRaw`DELETE FROM audit_log WHERE id = ${committedRowId}::uuid`,
      rejection,
    );
  });

  it('rejects statements that would match no row at all', async () => {
    await expectDatabaseRejection(
      prisma.$executeRaw`UPDATE audit_log SET action = 'tampered' WHERE false`,
      rejection,
    );
    await expectDatabaseRejection(prisma.$executeRaw`DELETE FROM audit_log WHERE false`, rejection);
  });

  it('rejects TRUNCATE', async () => {
    await expectDatabaseRejection(prisma.$executeRaw`TRUNCATE TABLE audit_log`, rejection);
  });

  it('rejects modification inside a transaction as well', async () => {
    await inRolledBackTransaction(prisma, async (transaction) => {
      await transaction.$executeRaw`
        INSERT INTO audit_log (actor_id, actor_role, action, resource_type)
        VALUES ('test-actor', 'admin', 'test.in-transaction', 'test')`;
      await expectDatabaseRejection(
        transaction.$executeRaw`UPDATE audit_log SET action = 'tampered' WHERE action = 'test.in-transaction'`,
        rejection,
      );
    });
  });

  it('keeps the trigger enabled for every role and replication mode, covering all three operations', async () => {
    // Catalog reads work for any role, so this check holds even where privileges hide the table.
    const triggers = await prisma.$queryRaw<{ definition: string; enabled: string }[]>`
      SELECT pg_get_triggerdef(oid) AS definition, tgenabled::text AS enabled
      FROM pg_trigger
      WHERE tgrelid = to_regclass('audit_log') AND tgname = 'audit_log_append_only'`;

    expect(triggers).toHaveLength(1);
    expect(triggers[0]?.enabled).toBe('A');
    // PostgreSQL prints the events in its own order, so each one is checked on its own.
    for (const operation of ['UPDATE', 'DELETE', 'TRUNCATE']) {
      expect(triggers[0]?.definition).toContain(operation);
    }
    expect(triggers[0]?.definition).toContain('BEFORE');
    expect(triggers[0]?.definition).toMatch(/FOR EACH STATEMENT/);
  });

  it('grants PUBLIC nothing on any application table', async () => {
    // Grantee 0 in an ACL is PUBLIC; an empty ACL (NULL) means only the owner has privileges.
    const publicGrants = await prisma.$queryRaw<{ tableName: string }[]>`
      SELECT c.relname AS "tableName"
      FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace
        AND c.relkind IN ('r', 'v', 'm', 'S')
        AND EXISTS (SELECT 1 FROM aclexplode(c.relacl) AS acl WHERE acl.grantee = 0)`;

    expect(publicGrants).toEqual([]);
  });

  describe(`as the ${APPLICATION_ROLE} role (skipped where the role does not exist)`, () => {
    it('may only INSERT into audit_log, and nothing else is granted on it', async (context) => {
      await inRolledBackTransaction(prisma, async (transaction) => {
        if (!(await tryAssumeApplicationRole(transaction))) {
          context.skip();
        }
        const privileges = await transaction.$queryRaw<{ privilege: string; granted: boolean }[]>`
          SELECT privilege, has_table_privilege(current_user, 'audit_log', privilege) AS granted
          FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) AS privilege`;

        expect(privileges.filter((entry) => entry.granted).map((entry) => entry.privilege)).toEqual(
          ['INSERT'],
        );
      });
    });

    it('can write an audit event through AuditService', async (context) => {
      const auditService = testApp.app.get(AuditService);
      await inRolledBackTransaction(prisma, async (transaction) => {
        if (!(await tryAssumeApplicationRole(transaction))) {
          context.skip();
        }
        await auditService.record(
          {
            actorId: 'test-actor',
            actorRole: 'employee',
            action: 'test.application-role-insert',
            resourceType: 'test',
            ip: '203.0.113.7',
            acr: '2',
            metadata: { reason: 'privilege check' },
          },
          transaction,
        );
      });
    });

    it('can never delete or truncate, and can update only customers and accounts', async (context) => {
      await inRolledBackTransaction(prisma, async (transaction) => {
        if (!(await tryAssumeApplicationRole(transaction))) {
          context.skip();
        }
        const privileges = await transaction.$queryRaw<{ table: string; privilege: string }[]>`
          SELECT t AS "table", p AS privilege
          FROM unnest(ARRAY['customers', 'accounts', 'transactions']) AS t,
               unnest(ARRAY['UPDATE', 'DELETE', 'TRUNCATE']) AS p
          WHERE has_table_privilege(current_user, t, p)
          ORDER BY t, p`;

        expect(privileges).toEqual([
          { table: 'accounts', privilege: 'UPDATE' },
          { table: 'customers', privilege: 'UPDATE' },
        ]);
      });
    });
  });
});
