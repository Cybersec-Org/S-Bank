import { ApiProblem } from '@/shared/api/problem';
import { FAKE_IBANS, mockUuid } from '@/shared/api/mock/mock-data';
import {
  createMockRunner,
  resolveMockOptions,
  type MockOptions,
} from '@/shared/api/mock/mock-runner';

import type { Recipient } from '../model/recipient';
import type { RecipientsRepository } from './recipients.repository';

const HTTP_NOT_FOUND = 404;
const FIRST_NEW_RECIPIENT_SEQUENCE = 500;

function initialRecipients(): Recipient[] {
  return [
    { id: mockUuid(301), name: 'Jan Przykładowy', iban: FAKE_IBANS.recipientJan },
    { id: mockUuid(302), name: 'Biuro Testowe Sp. z o.o.', iban: FAKE_IBANS.recipientOffice },
    { id: mockUuid(303), name: 'Maria Demonstracyjna', iban: FAKE_IBANS.recipientMaria },
  ];
}

export function createMockRecipientsRepository(
  partialOptions?: Partial<MockOptions>,
): RecipientsRepository {
  const runner = createMockRunner(resolveMockOptions(partialOptions));
  let recipients = initialRecipients();
  let nextSequence = FIRST_NEW_RECIPIENT_SEQUENCE;

  function requireRecipient(id: string): Recipient {
    const found = recipients.find((candidate) => candidate.id === id);
    if (found === undefined) {
      throw new ApiProblem({ status: HTTP_NOT_FOUND });
    }
    return found;
  }

  return {
    listRecipients: () => runner.run(() => (runner.empty ? [] : recipients)),
    createRecipient: (input) =>
      runner.run(() => {
        nextSequence += 1;
        const created: Recipient = { id: mockUuid(nextSequence), ...input };
        recipients = [...recipients, created];
        return created;
      }),
    updateRecipient: (id, input) =>
      runner.run(() => {
        requireRecipient(id);
        const updated: Recipient = { id, ...input };
        recipients = recipients.map((candidate) => (candidate.id === id ? updated : candidate));
        return updated;
      }),
    deleteRecipient: (id) =>
      runner.run(() => {
        requireRecipient(id);
        recipients = recipients.filter((candidate) => candidate.id !== id);
      }),
  };
}
