import { NotImplementedYet } from '@/shared/api/not-implemented';

import type { RecipientsRepository } from './recipients.repository';

const RECIPIENTS_BACKLOG_ID = 'B-22';

export function createHttpRecipientsRepository(): RecipientsRepository {
  return {
    listRecipients: () => Promise.reject(new NotImplementedYet(RECIPIENTS_BACKLOG_ID)),
    createRecipient: () => Promise.reject(new NotImplementedYet(RECIPIENTS_BACKLOG_ID)),
    updateRecipient: () => Promise.reject(new NotImplementedYet(RECIPIENTS_BACKLOG_ID)),
    deleteRecipient: () => Promise.reject(new NotImplementedYet(RECIPIENTS_BACKLOG_ID)),
  };
}
