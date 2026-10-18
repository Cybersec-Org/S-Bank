import { Injectable } from '@nestjs/common';
import type { AuditEvent, AuditLogWriter } from './audit-event.js';
import { AuditRepository } from './audit.repository.js';

/**
 * The only writer of the audit log. Pass the transaction client of the surrounding
 * `$transaction` so the audit row commits or rolls back together with the action it records.
 */
@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  async record(event: AuditEvent, transaction?: AuditLogWriter): Promise<void> {
    await this.repository.insert(event, transaction);
  }
}
