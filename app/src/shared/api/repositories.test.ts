import { createFakeDevApi, FAKE_DEV_API_URL } from '@/shared/testing/fake-dev-api';

import { createHybridRepositories, createRepositories } from './repositories';

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
<<<<<<< HEAD
  });

  it('uses the dev API for screens it supports and demo data for the rest in hybrid mode', async () => {
    const { transport, requests } = createFakeDevApi({
      'GET /public/rates': { body: { effectiveDate: '2026-11-10', rates: [] } },
    });
    const repositories = createHybridRepositories(getAcr, transport);

    await expect(repositories.rates.getRatesTable()).resolves.toMatchObject({ rates: [] });
    await expect(repositories.recipients.listRecipients()).resolves.not.toHaveLength(0);
    expect(requests.map((request) => request.url)).toEqual([`${FAKE_DEV_API_URL}/public/rates`]);
  });

  it('refuses hybrid mode without the API address and identity', () => {
    expect(() => createRepositories({ mode: 'hybrid', getAcr })).toThrow(/Hybrid/);
=======
>>>>>>> origin/passkeys-and-stepup
  });
});
