import { z } from 'zod';

import { pathSegment, type DevApiTransport } from '@/shared/api/dev-api-transport';

import { applyTransactionQuery } from '../model/account';
import type { AccountsRepository } from './accounts.repository';
import {
  devApiAccountSchema,
  devApiTransactionSchema,
  isDisplayedAccount,
  mapDevApiAccount,
  mapDevApiTransaction,
} from './accounts.dev-api';

const accountsResponseSchema = z.array(devApiAccountSchema);
const transactionsResponseSchema = z.array(devApiTransactionSchema);

/**
 * `GET /accounts` and `GET /accounts/:id/transactions` of the dev API. The API returns the whole history
 * without filters, so the query is applied here.
 */
export function createDevHttpAccountsRepository(transport: DevApiTransport): AccountsRepository {
  return {
    listAccounts: async () => {
      const accounts = await transport.request({
        method: 'GET',
        path: '/accounts',
        schema: accountsResponseSchema,
      });
      return accounts.filter(isDisplayedAccount).map(mapDevApiAccount);
    },
    listTransactions: async (accountId, query) => {
      const transactions = await transport.request({
        method: 'GET',
        path: `/accounts/${pathSegment(accountId)}/transactions`,
        schema: transactionsResponseSchema,
      });
      const own = new Set([accountId]);
      return applyTransactionQuery(
        transactions.map((transaction) => mapDevApiTransaction(transaction, own)),
        query,
      );
    },
  };
}
