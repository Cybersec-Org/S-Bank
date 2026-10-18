export const recipientsKeys = {
  all: ['recipients'] as const,
  list: () => [...recipientsKeys.all, 'list'] as const,
};
