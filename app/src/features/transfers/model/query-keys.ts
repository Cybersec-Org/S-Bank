export const transfersKeys = {
  all: ['transfers'] as const,
  draft: (draftId: string) => [...transfersKeys.all, 'draft', draftId] as const,
};
