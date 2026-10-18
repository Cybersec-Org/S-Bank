export const settingsKeys = {
  all: ['settings'] as const,
  security: () => [...settingsKeys.all, 'security'] as const,
  passkeys: () => [...settingsKeys.all, 'passkeys'] as const,
};
