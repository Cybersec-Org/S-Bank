import { createDevHttpAccountsRepository } from '@/features/accounts/api/accounts.dev-http';
import { createHttpAccountsRepository } from '@/features/accounts/api/accounts.http';
import { createMockAccountsRepository } from '@/features/accounts/api/accounts.mock';
import type { AccountsRepository } from '@/features/accounts/api/accounts.repository';
import { createHttpAdminRepository } from '@/features/admin/api/admin.http';
import { createMockAdminRepository } from '@/features/admin/api/admin.mock';
import type { AdminRepository } from '@/features/admin/api/admin.repository';
import { createHttpAtmsRepository } from '@/features/atms/api/atms.http';
import { createMockAtmsRepository } from '@/features/atms/api/atms.mock';
import type { AtmsRepository } from '@/features/atms/api/atms.repository';
import { createDevHttpEmployeeRepository } from '@/features/employee/api/employee.dev-http';
import { createHttpEmployeeRepository } from '@/features/employee/api/employee.http';
import { createMockEmployeeRepository } from '@/features/employee/api/employee.mock';
import type { EmployeeRepository } from '@/features/employee/api/employee.repository';
import { createHttpPaymentsRepository } from '@/features/payments/api/payments.http';
import { createMockPaymentsRepository } from '@/features/payments/api/payments.mock';
import type { PaymentsRepository } from '@/features/payments/api/payments.repository';
import { createDevHttpRatesRepository } from '@/features/rates/api/rates.dev-http';
import { createHttpRatesRepository } from '@/features/rates/api/rates.http';
import { createMockRatesRepository } from '@/features/rates/api/rates.mock';
import type { RatesRepository } from '@/features/rates/api/rates.repository';
import { createHttpRecipientsRepository } from '@/features/recipients/api/recipients.http';
import { createMockRecipientsRepository } from '@/features/recipients/api/recipients.mock';
import type { RecipientsRepository } from '@/features/recipients/api/recipients.repository';
import { createHttpSettingsRepository } from '@/features/settings/api/settings.http';
import { createMockSettingsRepository } from '@/features/settings/api/settings.mock';
import type { SettingsRepository } from '@/features/settings/api/settings.repository';
import { createDevHttpTransfersRepository } from '@/features/transfers/api/transfers.dev-http';
import { createHttpTransfersRepository } from '@/features/transfers/api/transfers.http';
import { createMockTransfersRepository } from '@/features/transfers/api/transfers.mock';
import type { TransfersRepository } from '@/features/transfers/api/transfers.repository';
import type { DevApiIdentity } from '@/shared/auth/dev-api-identity';
import type { AssuranceLevel } from '@/shared/auth/roles';
import type { ApiMode } from '@/shared/config/env';

import { createDevApiTransport, type DevApiTransport } from './dev-api-transport';
import type { AccessTokenProvider } from './client';
import { createHttpTransport } from './http';
import type { MockOptions } from './mock/mock-runner';

export interface Repositories {
  readonly accounts: AccountsRepository;
  readonly admin: AdminRepository;
  readonly atms: AtmsRepository;
  readonly employee: EmployeeRepository;
  readonly payments: PaymentsRepository;
  readonly rates: RatesRepository;
  readonly recipients: RecipientsRepository;
  readonly settings: SettingsRepository;
  readonly transfers: TransfersRepository;
}

interface RepositoryContext {
  readonly mode: ApiMode;
  /** Current authentication level; the mock transfer API uses it to emulate the server-side step-up check. */
  readonly getAcr: () => AssuranceLevel;
  /** Hybrid mode only: where the dev API runs and who the signed-in demo user is. */
  readonly baseUrl?: string;
  readonly getIdentity?: () => DevApiIdentity | null;
  /** Current in-memory OIDC access token; used only by live `*.http.ts` repositories. */
  readonly getAccessToken?: AccessTokenProvider | undefined;
}

/** Deterministic in-memory repositories; `options` lets tests remove latency or force errors. */
export function createMockRepositories(
  getAcr: () => AssuranceLevel,
  options?: Partial<MockOptions>,
): Repositories {
  const accounts = createMockAccountsRepository(options);
  return {
    accounts,
    admin: createMockAdminRepository(options),
    atms: createMockAtmsRepository(options),
    employee: createMockEmployeeRepository(options),
    payments: createMockPaymentsRepository(accounts, options),
    rates: createMockRatesRepository(options),
    recipients: createMockRecipientsRepository(options),
    settings: createMockSettingsRepository(options),
    transfers: createMockTransfersRepository({ ledger: accounts, getAcr }, options),
  };
}

/** Repositories backed by the NestJS API. */
export function createHttpRepositories(
  getAccessToken: AccessTokenProvider = () => undefined,
): Repositories {
  const transport = createHttpTransport(getAccessToken);
  return {
    accounts: createHttpAccountsRepository(transport),
    admin: createHttpAdminRepository(transport),
    atms: createHttpAtmsRepository(),
    employee: createHttpEmployeeRepository(transport),
    payments: createHttpPaymentsRepository(transport),
    rates: createHttpRatesRepository(transport),
    recipients: createHttpRecipientsRepository(transport),
    settings: createHttpSettingsRepository(transport),
    transfers: createHttpTransfersRepository(transport),
  };
}

/**
 * Development only: accounts, history, transfers, rates and the employee panel use the dev API; features
 * the API does not have yet (payments, recipients, settings, ATMs, admin) stay on demo data.
 */
export function createHybridRepositories(
  getAcr: () => AssuranceLevel,
  transport: DevApiTransport,
): Repositories {
  const demo = createMockRepositories(getAcr);
  return {
    ...demo,
    accounts: createDevHttpAccountsRepository(transport),
    employee: createDevHttpEmployeeRepository(transport),
    rates: createDevHttpRatesRepository(transport),
    transfers: createDevHttpTransfersRepository(transport),
  };
}

/** The only place that decides between mock and live data. */
export function createRepositories({
  mode,
  getAcr,
  baseUrl,
  getIdentity,
  getAccessToken,
}: RepositoryContext): Repositories {
  switch (mode) {
    case 'mock':
      return createMockRepositories(getAcr);
    case 'hybrid':
      if (baseUrl === undefined || getIdentity === undefined) {
        throw new Error('Hybrid mode needs the API base URL and the demo identity');
      }
      return createHybridRepositories(getAcr, createDevApiTransport({ baseUrl, getIdentity }));
    case 'live':
      return createHttpRepositories(getAccessToken);
  }
}
