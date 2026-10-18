import type { Recipient, RecipientInput } from '../model/recipient';

export interface RecipientsRepository {
  listRecipients: () => Promise<readonly Recipient[]>;
  createRecipient: (input: RecipientInput) => Promise<Recipient>;
  updateRecipient: (id: string, input: RecipientInput) => Promise<Recipient>;
  deleteRecipient: (id: string) => Promise<void>;
}
