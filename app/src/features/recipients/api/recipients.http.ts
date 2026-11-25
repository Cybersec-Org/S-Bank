import { z } from 'zod';

import { voidResponseSchema, type HttpTransport } from '@/shared/api/http';
import { normalizeIban } from '@/shared/lib/iban';

import type { RecipientInput } from '../model/recipient';
import type { RecipientsRepository } from './recipients.repository';

const apiRecipientSchema = z.object({
  id: z.string(),
  name: z.string(),
  iban: z.string(),
});

export function createHttpRecipientsRepository(transport: HttpTransport): RecipientsRepository {
  return {
    async listRecipients() {
      return transport.requestJson('/recipients', z.array(apiRecipientSchema));
    },
    async createRecipient(input: RecipientInput) {
      return transport.requestJson('/recipients', apiRecipientSchema, {
        method: 'POST',
        body: { name: input.name.trim(), iban: normalizeIban(input.iban) },
      });
    },
    async updateRecipient(id: string, input: RecipientInput) {
      await transport.requestJson(`/recipients/${encodeURIComponent(id)}`, voidResponseSchema, {
        method: 'DELETE',
      });
      return transport.requestJson('/recipients', apiRecipientSchema, {
        method: 'POST',
        body: { name: input.name.trim(), iban: normalizeIban(input.iban) },
      });
    },
    async deleteRecipient(id: string) {
      await transport.requestJson(`/recipients/${encodeURIComponent(id)}`, voidResponseSchema, {
        method: 'DELETE',
      });
    },
  };
}
