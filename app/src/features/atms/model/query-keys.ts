export const atmsKeys = {
  all: ['atms'] as const,
  list: () => [...atmsKeys.all, 'list'] as const,
};
