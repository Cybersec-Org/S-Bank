import { z } from 'zod';

import type { HttpTransport } from '@/shared/api/http';

import type { AuditAction, AuditEntry, ManagedUser } from '../model/admin';
import type { AdminRepository } from './admin.repository';

const apiAuditSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userRole: z.string(),
  action: z.string(),
  ipAddress: z.string().nullable().optional(),
  createdAt: z.string(),
});

const apiCustomerSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
});

function mapAuditAction(raw: string): AuditAction {
  if (raw.includes('TRANSFER')) {
    return 'transferConfirmed';
  }
  if (raw.includes('VIEW')) {
    return 'customerViewed';
  }
  if (raw.includes('ROLE') || raw.includes('CONFIG')) {
    return 'roleChanged';
  }
  return 'login';
}

export function createHttpAdminRepository(transport: HttpTransport): AdminRepository {
  return {
    async listUsers(): Promise<readonly ManagedUser[]> {
      const customers = await transport.requestJson('/customers', z.array(apiCustomerSchema));
      return customers.map((customer) => ({
        id: customer.id,
        displayName: `${customer.firstName} ${customer.lastName}`.trim(),
        email: customer.email,
        roles: ['customer'],
      }));
    },
    async listPartners() {
      return Promise.resolve([]);
    },
    async listAuditEntries(): Promise<readonly AuditEntry[]> {
      const logs = await transport.requestJson(
        '/accounts/audit-logs',
        z.array(apiAuditSchema),
      );
      return logs.map((entry) => ({
        id: entry.id,
        occurredAt: entry.createdAt,
        actorName: `${entry.userId} (${entry.userRole})`,
        action: mapAuditAction(entry.action),
        ipAddress: entry.ipAddress ?? '127.0.0.1',
        acr: entry.userRole === 'ADMIN' || entry.userRole === 'EMPLOYEE' ? '2' : '1',
      }));
    },
  };
}
