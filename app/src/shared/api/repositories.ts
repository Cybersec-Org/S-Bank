import { createHttpAccountsRepository } from '@/features/accounts/api/accounts.http';
import { createMockAccountsRepository } from '@/features/accounts/api/accounts.mock';
import type { AccountsRepository } from '@/features/accounts/api/accounts.repository';
import { createHttpAdminRepository } from '@/features/admin/api/admin.http';
import { createMockAdminRepository } from '@/features/admin/api/admin.mock';
import type { AdminRepository } from '@/features/admin/api/admin.repository';
import { createHttpAtmsRepository } from '@/features/atms/api/atms.http';
import { createMockAtmsRepository } from '@/features/atms/api/atms.mock';
import type { AtmsRepository } from '@/features/atms/api/atms.repository';
import { createHttpEmployeeRepository } from '@/features/employee/api/employee.http';
import { createMockEmployeeRepository } from '@/features/employee/api/employee.mock';
import type { EmployeeRepository } from '@/features/employee/api/employee.repository';
import { createHttpPaymentsRepository } from '@/features/payments/api/payments.http';
import { createMockPaymentsRepository } from '@/features/payments/api/payments.mock';
import type { PaymentsRepository } from '@/features/payments/api/payments.repository';
import { createHttpRatesRepository } from '@/features/rates/api/rates.http';
import { createMockRatesRepository } from '@/features/rates/api/rates.mock';
import type { RatesRepository } from '@/features/rates/api/rates.repository';
import { createHttpRecipientsRepository } from '@/features/recipients/api/recipients.http';
import { createMockRecipientsRepository } from '@/features/recipients/api/recipients.mock';
import type { RecipientsRepository } from '@/features/recipients/api/recipients.repository';
import { createHttpSettingsRepository } from '@/features/settings/api/settings.http';
import { createMockSettingsRepository } from '@/features/settings/api/settings.mock';
import type { SettingsRepository } from '@/features/settings/api/settings.repository';
import { createHttpTransfersRepository } from '@/features/transfers/api/transfers.http';
import { createMockTransfersRepository } from '@/features/transfers/api/transfers.mock';
import type { TransfersRepository } from '@/features/transfers/api/transfers.repository';
import type { AssuranceLevel } from '@/shared/auth/roles';
import type { ApiMode } from '@/shared/config/env';

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

/** Repositories backed by the API; each throws `NotImplementedYet` until its endpoint exists. */
export function createHttpRepositories(): Repositories {
  return {
    accounts: createHttpAccountsRepository(),
    admin: createHttpAdminRepository(),
    atms: createHttpAtmsRepository(),
    employee: createHttpEmployeeRepository(),
    payments: createHttpPaymentsRepository(),
    rates: createHttpRatesRepository(),
    recipients: createHttpRecipientsRepository(),
    settings: createHttpSettingsRepository(),
    transfers: createHttpTransfersRepository(),
  };
}

/** The only place that decides between mock and live data. */
export function createRepositories({ mode, getAcr }: RepositoryContext): Repositories {
  return mode === 'mock' ? createMockRepositories(getAcr) : createHttpRepositories();
}
