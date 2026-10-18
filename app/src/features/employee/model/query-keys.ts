export const employeeKeys = {
  all: ['employee'] as const,
  search: (query: string) => [...employeeKeys.all, 'search', query] as const,
  details: (customerId: string) => [...employeeKeys.all, 'details', customerId] as const,
};
