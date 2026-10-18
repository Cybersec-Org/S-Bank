import { describe, expect, it, vi } from 'vitest';
import type { AuditEvent, AuditLogWriter } from './audit-event.js';
import type { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';

const event: AuditEvent = {
  actorId: 'admin-1',
  actorRole: 'admin',
  action: 'audit.read',
  resourceType: 'audit_log',
  acr: '2',
};

describe('AuditService', () => {
  it('hands the event and the transaction client to the repository', async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    const service = new AuditService({ insert } as unknown as AuditRepository);
    const transaction = { auditLog: {} } as unknown as AuditLogWriter;

    await service.record(event, transaction);

    expect(insert).toHaveBeenCalledWith(event, transaction);
  });

  it('propagates repository failures so the surrounding transaction rolls back', async () => {
    const insert = vi.fn().mockRejectedValue(new Error('insert failed'));
    const service = new AuditService({ insert } as unknown as AuditRepository);

    await expect(service.record(event)).rejects.toThrow('insert failed');
  });
});
