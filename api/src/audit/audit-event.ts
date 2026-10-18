import type { Prisma } from '../generated/prisma/client.js';

/** What happened, who did it and how strongly they were authenticated (SR-14). */
export interface AuditEvent {
  readonly actorId: string;
  readonly actorRole: string;
  /** Verb-like action name, for example `account.viewed` or `transfer.confirmed`. */
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly ip?: string;
  readonly acr?: string;
  /** Never tokens, passwords, full IBANs or balances. */
  readonly metadata?: Prisma.InputJsonObject;
}

/** The slice of a Prisma client (or transaction client) the audit log needs. */
export type AuditLogWriter = Pick<Prisma.TransactionClient, 'auditLog'>;
