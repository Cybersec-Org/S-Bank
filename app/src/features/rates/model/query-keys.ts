export const ratesKeys = {
  all: ['rates'] as const,
  table: () => [...ratesKeys.all, 'table'] as const,
};
