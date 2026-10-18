import { NotImplementedYet } from '@/shared/api/not-implemented';

import type { TransfersRepository } from './transfers.repository';

const TRANSFERS_BACKLOG_ID = 'B-18';

export function createHttpTransfersRepository(): TransfersRepository {
  return {
    createDraft: () => Promise.reject(new NotImplementedYet(TRANSFERS_BACKLOG_ID)),
    getDraft: () => Promise.reject(new NotImplementedYet(TRANSFERS_BACKLOG_ID)),
    confirmDraft: () => Promise.reject(new NotImplementedYet(TRANSFERS_BACKLOG_ID)),
    cancelDraft: () => Promise.reject(new NotImplementedYet(TRANSFERS_BACKLOG_ID)),
  };
}
