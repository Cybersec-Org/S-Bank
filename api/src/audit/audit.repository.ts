import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuditEvent, AuditLogWriter } from './audit-event.js';

/**
 * Insert-only access to `audit_log`; there is deliberately no update or delete method.
 * Uses `createMany` because `create` ends in `INSERT ... RETURNING`, which needs the SELECT
 * privilege that the application role does not have on this table.
 */
@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(event: AuditEvent, writer: AuditLogWriter = this.prisma): Promise<void> {
    await writer.auditLog.createMany({
      data: [
        {
          actorId: event.actorId,
          actorRole: event.actorRole,
          action: event.action,
          resourceType: event.resourceType,
          ...(event.resourceId !== undefined && { resourceId: event.resourceId }),
          ...(event.ip !== undefined && { ip: event.ip }),
          ...(event.acr !== undefined && { acr: event.acr }),
          ...(event.metadata !== undefined && { metadata: event.metadata }),
        },
      ],
    });
  }
}
