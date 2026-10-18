import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditLogWriter } from './audit-event.js';
import { AuditRepository } from './audit.repository.js';

function fakeWriter() {
  const create = vi
    .fn<(args: { data: Record<string, unknown>[] }) => Promise<{ count: number }>>()
    .mockResolvedValue({ count: 1 });
  return { create, writer: { auditLog: { createMany: create } } as unknown as AuditLogWriter };
}

describe('AuditRepository', () => {
  it('exposes insert only: the audit log has no update or delete path', () => {
    expect(Object.getOwnPropertyNames(AuditRepository.prototype).sort()).toEqual([
      'constructor',
      'insert',
    ]);
  });

  it('writes the event through the given transaction client', async () => {
    const { create, writer } = fakeWriter();
    const repository = new AuditRepository({} as PrismaService);

    await repository.insert(
      {
        actorId: 'employee-1',
        actorRole: 'employee',
        action: 'account.viewed',
        resourceType: 'account',
        resourceId: 'account-1',
        ip: '203.0.113.7',
        acr: '2',
        metadata: { reason: 'support' },
      },
      writer,
    );

    expect(create).toHaveBeenCalledWith({
      data: [
        {
          actorId: 'employee-1',
          actorRole: 'employee',
          action: 'account.viewed',
          resourceType: 'account',
          resourceId: 'account-1',
          ip: '203.0.113.7',
          acr: '2',
          metadata: { reason: 'support' },
        },
      ],
    });
  });

  it('leaves optional columns out instead of writing undefined', async () => {
    const { create, writer } = fakeWriter();
    const repository = new AuditRepository({} as PrismaService);

    await repository.insert(
      { actorId: 'anonymous', actorRole: 'guest', action: 'login.failed', resourceType: 'session' },
      writer,
    );

    expect(create.mock.calls[0]?.[0].data).toEqual([
      {
        actorId: 'anonymous',
        actorRole: 'guest',
        action: 'login.failed',
        resourceType: 'session',
      },
    ]);
  });

  it('falls back to the application client outside a transaction', async () => {
    const { create, writer } = fakeWriter();
    const repository = new AuditRepository(writer as unknown as PrismaService);

    await repository.insert({
      actorId: 'a',
      actorRole: 'admin',
      action: 'role.changed',
      resourceType: 'user',
    });

    expect(create).toHaveBeenCalledTimes(1);
  });
});
