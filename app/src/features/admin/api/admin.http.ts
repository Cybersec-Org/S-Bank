import { NotImplementedYet } from '@/shared/api/not-implemented';

import type { AdminRepository } from './admin.repository';

const ADMIN_BACKLOG_ID = 'B-29';

export function createHttpAdminRepository(): AdminRepository {
  return {
    listUsers: () => Promise.reject(new NotImplementedYet(ADMIN_BACKLOG_ID)),
    listPartners: () => Promise.reject(new NotImplementedYet(ADMIN_BACKLOG_ID)),
    listAuditEntries: () => Promise.reject(new NotImplementedYet(ADMIN_BACKLOG_ID)),
  };
}
