import { z } from 'zod';

import {
  groszeToPln,
  plnToGrosze,
  voidResponseSchema,
  type HttpTransport,
} from '@/shared/api/http';

import type { CustomerDetails, CustomerSummary } from '../model/customer';
import type { EmployeeRepository } from './employee.repository';

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
  receiverName: z.string().nullable().optional(),
  amount: z.number(),
  title: z.string(),
  executedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

const apiCustomerSummarySchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  customerNumber: z.string(),
});

const apiCustomerDetailsSchema = apiCustomerSummarySchema.extend({
  accounts: z.array(apiAccountSchema).default([]),
  transactions: z.array(apiTransactionSchema).default([]),
});

function parseCustomerNumber(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapSummary(raw: z.infer<typeof apiCustomerSummarySchema>): CustomerSummary {
  return {
    id: raw.id,
    displayName: `${raw.firstName} ${raw.lastName}`.trim(),
    email: raw.email,
    customerNumber: parseCustomerNumber(raw.customerNumber),
  };
}

export function createHttpEmployeeRepository(transport: HttpTransport): EmployeeRepository {
  return {
    async searchCustomers(query: string) {
      const encoded = encodeURIComponent(query.trim());
      const items = await transport.requestJson(
        `/customers?query=${encoded}`,
        z.array(apiCustomerSummarySchema),
      );
      return items.map(mapSummary);
    },
    async getCustomerDetails(customerId: string): Promise<CustomerDetails> {
      const details = await transport.requestJson(
        `/customers/${encodeURIComponent(customerId)}`,
        apiCustomerDetailsSchema,
      );
      const accountIds = new Set(details.accounts.map((a) => a.id));
      return {
        customer: mapSummary(details),
        accounts: details.accounts.map((raw) => ({
          id: raw.id,
          name: raw.currency === 'PLN' ? 'Osobisty' : `Walutowy (${raw.currency})`,
          iban: raw.iban,
          balanceGrosze: plnToGrosze(raw.balance),
          dailyLimitGrosze: plnToGrosze(raw.dailyLimit),
          dailyUsedGrosze: plnToGrosze(raw.dailyUsed),
          status: raw.status === 'ACTIVE' ? 'active' : 'blocked',
        })),
        transactions: details.transactions.map((tx) => ({
          id: tx.id,
          accountId: tx.senderAccountId,
          direction: accountIds.has(tx.senderAccountId) ? 'outgoing' : 'incoming',
          kind: 'transfer',
          amountGrosze: plnToGrosze(tx.amount),
          title: tx.title,
          counterpartyName: tx.receiverName ?? 'Przelew',
          bookedAt: tx.executedAt ?? tx.createdAt,
        })),
      };
    },
    async setDailyLimit(accountId: string, limitGrosze: number) {
      await transport.requestJson(
        `/accounts/${encodeURIComponent(accountId)}/limit`,
        voidResponseSchema,
        {
          method: 'PATCH',
          body: { newLimit: groszeToPln(limitGrosze) },
        },
      );
    },
    async setAccountBlocked(accountId: string, blocked: boolean) {
      await transport.requestJson(
        `/accounts/${encodeURIComponent(accountId)}/status`,
        voidResponseSchema,
        {
          method: 'PATCH',
          body: { status: blocked ? 'FROZEN' : 'ACTIVE' },
        },
      );
    },
  };
}
