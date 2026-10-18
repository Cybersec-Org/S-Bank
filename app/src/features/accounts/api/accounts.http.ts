import { NotImplementedYet } from '@/shared/api/not-implemented';

import type { AccountsRepository } from './accounts.repository';

const ACCOUNTS_BACKLOG_ID = 'B-12';

export function createHttpAccountsRepository(): AccountsRepository {
  return {
    listAccounts: () => Promise.reject(new NotImplementedYet(ACCOUNTS_BACKLOG_ID)),
    listTransactions: () => Promise.reject(new NotImplementedYet(ACCOUNTS_BACKLOG_ID)),
  };
}
