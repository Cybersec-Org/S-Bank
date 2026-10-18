import { mockUuid } from '@/shared/api/mock/mock-data';
import {
  createMockRunner,
  resolveMockOptions,
  type MockOptions,
} from '@/shared/api/mock/mock-runner';

import type { AuditEntry, ManagedUser, Partner } from '../model/admin';
import type { AdminRepository } from './admin.repository';

const USERS: readonly ManagedUser[] = [
  {
    id: mockUuid(601),
    displayName: 'Anna Testowa',
    email: 'anna.testowa@example.test',
    roles: ['customer'],
  },
  {
    id: mockUuid(602),
    displayName: 'Jan Przykładowy',
    email: 'jan.przykladowy@example.test',
    roles: ['employee'],
  },
  {
    id: mockUuid(603),
    displayName: 'Adam Demonstracyjny',
    email: 'adam.demonstracyjny@example.test',
    roles: ['admin'],
  },
];

const PARTNERS: readonly Partner[] = [
  {
    id: mockUuid(611),
    name: 'Sklep Demonstracyjny',
    certificateThumbprint: 'AB12…9F40',
    status: 'active',
  },
  {
    id: mockUuid(612),
    name: 'Kawiarnia Testowa',
    certificateThumbprint: 'CD34…1E22',
    status: 'suspended',
  },
];

/** Documentation-range addresses (RFC 5737), so no real client IP appears in demo data. */
const AUDIT_ENTRIES: readonly AuditEntry[] = [
  {
    id: mockUuid(621),
    occurredAt: '2026-10-15T08:55:00.000Z',
    actorName: 'Jan Przykładowy',
    action: 'customerViewed',
    ipAddress: '192.0.2.10',
    acr: '2',
  },
  {
    id: mockUuid(622),
    occurredAt: '2026-10-15T08:40:00.000Z',
    actorName: 'Anna Testowa',
    action: 'transferConfirmed',
    ipAddress: '192.0.2.44',
    acr: '2',
  },
  {
    id: mockUuid(623),
    occurredAt: '2026-10-15T08:31:00.000Z',
    actorName: 'Anna Testowa',
    action: 'login',
    ipAddress: '192.0.2.44',
    acr: '1',
  },
  {
    id: mockUuid(624),
    occurredAt: '2026-10-14T16:02:00.000Z',
    actorName: 'Adam Demonstracyjny',
    action: 'roleChanged',
    ipAddress: '192.0.2.7',
    acr: '2',
  },
];

export function createMockAdminRepository(partialOptions?: Partial<MockOptions>): AdminRepository {
  const runner = createMockRunner(resolveMockOptions(partialOptions));
  return {
    listUsers: () => runner.run(() => (runner.empty ? [] : USERS)),
    listPartners: () => runner.run(() => (runner.empty ? [] : PARTNERS)),
    listAuditEntries: () => runner.run(() => (runner.empty ? [] : AUDIT_ENTRIES)),
  };
}
