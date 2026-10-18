import {
  createMockRunner,
  resolveMockOptions,
  type MockOptions,
} from '@/shared/api/mock/mock-runner';

import type { RatesTable } from '../model/rate';
import type { RatesRepository } from './rates.repository';

/** Illustrative values, not real NBP data. */
const MOCK_TABLE: RatesTable = {
  tableNumber: '199/A/NBP/2026',
  effectiveDate: '2026-10-15T00:00:00.000Z',
  rates: [
    { code: 'EUR', name: 'euro', midRateScaled: 42_315 },
    { code: 'USD', name: 'dolar amerykański', midRateScaled: 39_120 },
    { code: 'CHF', name: 'frank szwajcarski', midRateScaled: 45_240 },
    { code: 'GBP', name: 'funt szterling', midRateScaled: 49_780 },
    { code: 'CZK', name: 'korona czeska', midRateScaled: 1_735 },
  ],
};

export function createMockRatesRepository(partialOptions?: Partial<MockOptions>): RatesRepository {
  const runner = createMockRunner(resolveMockOptions(partialOptions));
  return {
    getRatesTable: () =>
      runner.run(() => (runner.empty ? { ...MOCK_TABLE, rates: [] } : MOCK_TABLE)),
  };
}
