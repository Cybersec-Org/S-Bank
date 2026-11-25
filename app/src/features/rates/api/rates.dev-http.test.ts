import { createFakeDevApi } from '@/shared/testing/fake-dev-api';

import { createDevHttpRatesRepository } from './rates.dev-http';

describe('dev API rates repository', () => {
  it('keeps the displayed currencies in order with Polish names and scaled rates', async () => {
    const { transport } = createFakeDevApi({
      'GET /public/rates': {
        body: {
          source: 'nbp',
          effectiveDate: '2026-11-10',
          rates: [
            { code: 'PLN', currency: 'Polish Zloty', mid: 1 },
            { code: 'USD', currency: 'US Dollar', mid: 3.9132 },
            { code: 'EUR', currency: 'Euro', mid: 4.3789 },
            { code: 'JPY', currency: 'Japanese Yen', mid: 0.0251 },
          ],
        },
      },
    });

    const table = await createDevHttpRatesRepository(transport).getRatesTable();

    expect(table).toEqual({
      tableNumber: null,
      effectiveDate: '2026-11-10',
      rates: [
        { code: 'EUR', name: 'euro', midRateScaled: 43_789 },
        { code: 'USD', name: 'dolar amerykański', midRateScaled: 39_132 },
      ],
    });
  });
});
