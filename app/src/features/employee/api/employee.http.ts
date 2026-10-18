import { NotImplementedYet } from '@/shared/api/not-implemented';

import type { EmployeeRepository } from './employee.repository';

const EMPLOYEE_BACKLOG_ID = 'B-24';

export function createHttpEmployeeRepository(): EmployeeRepository {
  return {
    searchCustomers: () => Promise.reject(new NotImplementedYet(EMPLOYEE_BACKLOG_ID)),
    getCustomerDetails: () => Promise.reject(new NotImplementedYet(EMPLOYEE_BACKLOG_ID)),
    setDailyLimit: () => Promise.reject(new NotImplementedYet(EMPLOYEE_BACKLOG_ID)),
    setAccountBlocked: () => Promise.reject(new NotImplementedYet(EMPLOYEE_BACKLOG_ID)),
  };
}
