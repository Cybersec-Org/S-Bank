import type { CustomerDetails, CustomerSummary } from '../model/customer';

export interface EmployeeRepository {
  searchCustomers: (query: string) => Promise<readonly CustomerSummary[]>;
  /** Read-only view; every call is written to the audit log on the server (SR-14). */
  getCustomerDetails: (customerId: string) => Promise<CustomerDetails>;
  setDailyLimit: (accountId: string, limitGrosze: number) => Promise<void>;
  setAccountBlocked: (accountId: string, blocked: boolean) => Promise<void>;
}
