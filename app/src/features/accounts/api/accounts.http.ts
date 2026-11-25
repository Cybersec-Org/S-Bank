import { z } from 'zod';

import { plnToGrosze, voidResponseSchema, type HttpTransport } from '@/shared/api/http';

import type { Account, Transaction, TransactionQuery } from '../model/account';
import type { AccountsRepository } from './accounts.repository';

const apiAccountSchema = z.object({
  id: z.string(),
  iban: z.string(),
  currency: z.string().default('PLN'),
  balance: z.number(),
  dailyLimit: z.number(),
  dailyUsed: z.number().default(0),
  status: z.string(),
});

const apiTransactionSchema = z.object({
  id: z.string(),
  senderAccountId: z.string(),
  receiverAccountId: z.string().nullable().optional(),
  receiverName: z.string().nullable().optional(),
  amount: z.number(),
  title: z.string(),
  executedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

export function mapApiAccount(raw: z.infer<typeof apiAccountSchema>): Account {
  return {
    id: raw.id,
    name: raw.currency === 'PLN' ? 'Osobisty' : `Walutowy (${raw.currency})`,
    iban: raw.iban,
    balanceGrosze: plnToGrosze(raw.balance),
    dailyLimitGrosze: plnToGrosze(raw.dailyLimit),
    dailyUsedGrosze: plnToGrosze(raw.dailyUsed),
    status: raw.status === 'ACTIVE' ? 'active' : 'blocked',
  };
}

export function mapApiTransaction(
  raw: z.infer<typeof apiTransactionSchema>,
  accountId: string,
): Transaction {
  const direction = raw.senderAccountId === accountId ? 'outgoing' : 'incoming';
  return {
    id: raw.id,
    accountId,
    direction,
    kind: 'transfer',
    amountGrosze: plnToGrosze(raw.amount),
    title: raw.title,
    counterpartyName: raw.receiverName ?? 'Przelew',
    bookedAt: raw.executedAt ?? raw.createdAt,
  };
}

export function createHttpAccountsRepository(transport: HttpTransport): AccountsRepository {
  return {
    async listAccounts() {
      const items = await transport.requestJson('/accounts', z.array(apiAccountSchema));
      return items.map(mapApiAccount);
    },
    async listTransactions(accountId: string, query: TransactionQuery) {
      const items = await transport.requestJson(
        `/accounts/${encodeURIComponent(accountId)}/transactions`,
        z.array(apiTransactionSchema),
      );
      let mapped = items.map((item) => mapApiTransaction(item, accountId));
      if (query.direction !== null) {
        mapped = mapped.filter((tx) => tx.direction === query.direction);
      }
      if (query.paymentsOnly) {
        mapped = mapped.filter((tx) => tx.kind === 'qr_payment' || tx.kind === 'link_payment');
      }
      if (query.from !== null) {
        const from = query.from;
        mapped = mapped.filter((tx) => tx.bookedAt.slice(0, 10) >= from);
      }
      if (query.to !== null) {
        const to = query.to;
        mapped = mapped.filter((tx) => tx.bookedAt.slice(0, 10) <= to);
      }
      if (query.limit !== null) {
        mapped = mapped.slice(0, query.limit);
      }
      return mapped;
    },
  };
}

export { voidResponseSchema };
