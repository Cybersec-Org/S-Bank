import { z } from 'zod';

import { pl } from '@/shared/i18n/pl';
import { DEFAULT_CURRENCY, zlotyToGrosze } from '@/shared/lib/money';

import type { Account, Transaction } from '../model/account';

/**
 * Response shapes of the dev API (`api/src/accounts/accounts.service.ts`). Its OpenAPI document has no
 * response schemas yet, so they are written here and every response is validated against them.
 */
export const devApiAccountSchema = z.object({
  id: z.string().min(1),
  iban: z.string().min(1),
  currency: z.string().min(1),
  balance: z.number(),
  dailyLimit: z.number(),
  dailyUsed: z.number(),
  status: z.enum(['ACTIVE', 'FROZEN', 'CLOSED']),
});
export type DevApiAccount = z.infer<typeof devApiAccountSchema>;

export const devApiTransactionSchema = z.object({
  id: z.string().min(1),
  senderAccountId: z.string().min(1),
  receiverAccountId: z.string().nullable(),
  receiverName: z.string(),
  amount: z.number(),
  title: z.string(),
  createdAt: z.string(),
  executedAt: z.string().nullable(),
});
export type DevApiTransaction = z.infer<typeof devApiTransactionSchema>;

/** The app shows PLN accounts only; foreign-currency accounts have no screen yet. */
export function isDisplayedAccount(account: DevApiAccount): boolean {
  return account.currency === DEFAULT_CURRENCY;
}

export function mapDevApiAccount(account: DevApiAccount): Account {
  return {
    id: account.id,
    // The API has no account name; every PLN account is the personal one in the design.
    name: pl.dashboard.defaultAccountName,
    iban: account.iban,
    balanceGrosze: zlotyToGrosze(account.balance),
    dailyLimitGrosze: zlotyToGrosze(account.dailyLimit),
    dailyUsedGrosze: zlotyToGrosze(account.dailyUsed),
    status: account.status === 'ACTIVE' ? 'active' : 'blocked',
  };
}

/**
 * Maps one API operation as seen from `ownAccountIds`. The API has no direction or sender name, so the
 * direction comes from which side is ours and incoming operations get a generic counterparty label.
 */
export function mapDevApiTransaction(
  transaction: DevApiTransaction,
  ownAccountIds: ReadonlySet<string>,
): Transaction {
  const outgoing = ownAccountIds.has(transaction.senderAccountId);
  return {
    id: transaction.id,
    accountId: outgoing
      ? transaction.senderAccountId
      : (transaction.receiverAccountId ?? transaction.senderAccountId),
    direction: outgoing ? 'outgoing' : 'incoming',
    kind: 'transfer',
    amountGrosze: zlotyToGrosze(Math.abs(transaction.amount)),
    title: transaction.title,
    counterpartyName: outgoing ? transaction.receiverName : pl.history.incomingCounterparty,
    bookedAt: transaction.executedAt ?? transaction.createdAt,
  };
}
