import {
  createMockRunner,
  resolveMockOptions,
  type MockOptions,
} from '@/shared/api/mock/mock-runner';

import type { RatesTable } from '../model/rate';
import type { RatesRepository } from './rates.repository';

/** Values of the design; illustrative, not real NBP data. */
const MOCK_TABLE: RatesTable = {
  tableNumber: '196/A/NBP/2026',
  effectiveDate: '2026-10-08T00:00:00.000Z',
  rates: [
    { code: 'EUR', name: 'euro', midRateScaled: 43_789 },
    { code: 'USD', name: 'dolar amerykański', midRateScaled: 39_132 },
    { code: 'CHF', name: 'frank szwajcarski', midRateScaled: 46_926 },
    { code: 'GBP', name: 'funt szterling', midRateScaled: 51_635 },
    { code: 'CZK', name: 'korona czeska', midRateScaled: 1_794 },
  ],
};

export function createMockRatesRepository(partialOptions?: Partial<MockOptions>): RatesRepository {
  const runner = createMockRunner(resolveMockOptions(partialOptions));
  return {
    getRatesTable: () =>
      runner.run(() => (runner.empty ? { ...MOCK_TABLE, rates: [] } : MOCK_TABLE)),
  };
}
