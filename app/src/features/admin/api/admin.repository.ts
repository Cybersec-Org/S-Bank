import type { AuditEntry, ManagedUser, Partner } from '../model/admin';

export interface AdminRepository {
  listUsers: () => Promise<readonly ManagedUser[]>;
  listPartners: () => Promise<readonly Partner[]>;
  /** Read-only: the audit log is append-only and offers no write or delete operation. */
  listAuditEntries: () => Promise<readonly AuditEntry[]>;
}
