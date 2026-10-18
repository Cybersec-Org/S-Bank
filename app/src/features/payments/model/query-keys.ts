export const paymentsKeys = {
  all: ['payments'] as const,
  request: (requestId: string) => [...paymentsKeys.all, 'request', requestId] as const,
};
