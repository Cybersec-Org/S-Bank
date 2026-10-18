import { NotImplementedYet } from '@/shared/api/not-implemented';

import type { AtmsRepository } from './atms.repository';

const ATMS_BACKLOG_ID = 'B-30';

export function createHttpAtmsRepository(): AtmsRepository {
  return {
    listAtms: () => Promise.reject(new NotImplementedYet(ATMS_BACKLOG_ID)),
  };
}
