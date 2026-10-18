import type { AssuranceLevel, Role } from '@/shared/auth/roles';

// B-29: switch to the generated schema types once the admin endpoints exist.
export interface ManagedUser {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly roles: readonly Role[];
}

export type PartnerStatus = 'active' | 'suspended';

export interface Partner {
  readonly id: string;
  readonly name: string;
  /** Shortened certificate thumbprint; the full value is never needed in the UI. */
  readonly certificateThumbprint: string;
  readonly status: PartnerStatus;
}

export type AuditAction = 'login' | 'transferConfirmed' | 'customerViewed' | 'roleChanged';

export interface AuditEntry {
  readonly id: string;
  readonly occurredAt: string;
  readonly actorName: string;
  readonly action: AuditAction;
  readonly ipAddress: string;
  readonly acr: AssuranceLevel;
}
