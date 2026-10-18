export const adminKeys = {
  all: ['admin'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  partners: () => [...adminKeys.all, 'partners'] as const,
  audit: () => [...adminKeys.all, 'audit'] as const,
};
