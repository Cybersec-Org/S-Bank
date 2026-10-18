import { createRepositories } from './repositories';

const getAcr = () => '1' as const;

describe('createRepositories', () => {
  it('serves demo data in mock mode', async () => {
    const repositories = createRepositories({ mode: 'mock', getAcr });

    await expect(repositories.rates.getRatesTable()).resolves.toMatchObject({
      rates: expect.any(Array) as unknown,
    });
  });

  it('never falls back to demo data in live mode: unfinished endpoints fail with the backlog id', async () => {
    const repositories = createRepositories({ mode: 'live', getAcr });

    await expect(repositories.accounts.listAccounts()).rejects.toMatchObject({
      name: 'NotImplementedYet',
      backlogId: 'B-12',
    });
    await expect(repositories.transfers.getDraft('x')).rejects.toMatchObject({ backlogId: 'B-18' });
    await expect(repositories.rates.getRatesTable()).rejects.toMatchObject({ backlogId: 'B-15' });
  });
});
