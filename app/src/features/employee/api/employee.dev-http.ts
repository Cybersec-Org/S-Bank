import { z } from 'zod';

import {
  devApiAccountSchema,
  devApiTransactionSchema,
  isDisplayedAccount,
  mapDevApiAccount,
  mapDevApiTransaction,
} from '@/features/accounts';
import { pathSegment, type DevApiTransport } from '@/shared/api/dev-api-transport';
import { groszeToZloty } from '@/shared/lib/money';

import type { CustomerDetails, CustomerSummary } from '../model/customer';
import type { EmployeeRepository } from './employee.repository';

const customerFields = {
  id: z.string().min(1),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  customerNumber: z.string(),
};

const searchResponseSchema = z.array(z.object(customerFields));

const detailsResponseSchema = z.object({
  ...customerFields,
  accounts: z.array(devApiAccountSchema),
  transactions: z.array(devApiTransactionSchema),
});

const accountResponseSchema = z.object({ id: z.string() });

function toSummary(customer: z.infer<typeof searchResponseSchema>[number]): CustomerSummary {
  return {
    id: customer.id,
    displayName: `${customer.firstName} ${customer.lastName}`.trim(),
    email: customer.email,
    customerNumber: customer.customerNumber,
  };
}

/**
 * Employee endpoints of the dev API: `GET /customers?query=`, `GET /customers/:id`,
 * `PATCH /accounts/:id/limit` and `PATCH /accounts/:id/status`. The API decides who may call them.
 */
export function createDevHttpEmployeeRepository(transport: DevApiTransport): EmployeeRepository {
  return {
    searchCustomers: async (query) => {
      const customers = await transport.request({
        method: 'GET',
        path: '/customers',
        query: { query: query.trim() },
        schema: searchResponseSchema,
      });
      return customers.map(toSummary);
    },
    getCustomerDetails: async (customerId): Promise<CustomerDetails> => {
      const details = await transport.request({
        method: 'GET',
        path: `/customers/${pathSegment(customerId)}`,
        schema: detailsResponseSchema,
      });
      const accounts = details.accounts.filter(isDisplayedAccount);
      const own = new Set(accounts.map((account) => account.id));
      return {
        customer: toSummary(details),
        accounts: accounts.map(mapDevApiAccount),
        transactions: details.transactions
          .map((transaction) => mapDevApiTransaction(transaction, own))
          .filter((transaction) => own.has(transaction.accountId))
          .sort((left, right) => right.bookedAt.localeCompare(left.bookedAt)),
      };
    },
    setDailyLimit: async (accountId, limitGrosze) => {
      await transport.request({
        method: 'PATCH',
        path: `/accounts/${pathSegment(accountId)}/limit`,
        schema: accountResponseSchema,
        body: { newLimit: groszeToZloty(limitGrosze) },
      });
    },
    setAccountBlocked: async (accountId, blocked) => {
      await transport.request({
        method: 'PATCH',
        path: `/accounts/${pathSegment(accountId)}/status`,
        schema: accountResponseSchema,
        body: { status: blocked ? 'FROZEN' : 'ACTIVE' },
      });
    },
  };
}
