import { createRepositories } from './repositories';

const getAcr = () => '1' as const;

describe('createRepositories', () => {
  it('serves demo data in mock mode', async () => {
    const repositories = createRepositories({ mode: 'mock', getAcr });

    await expect(repositories.rates.getRatesTable()).resolves.toMatchObject({
      rates: expect.any(Array) as unknown,
    });
  });

  it('never falls back to demo data in live mode', async () => {
    const repositories = createRepositories({ mode: 'live', getAcr });

    await expect(repositories.atms.listAtms()).rejects.toMatchObject({
      name: 'NotImplementedYet',
      backlogId: 'B-30',
    });
    expect(repositories.accounts.listAccounts).toBeDefined();
    expect(repositories.transfers.getDraft).toBeDefined();
    expect(repositories.rates.getRatesTable).toBeDefined();
  });
});
