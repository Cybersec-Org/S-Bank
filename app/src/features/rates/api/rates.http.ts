import { NotImplementedYet } from '@/shared/api/not-implemented';

import type { RatesRepository } from './rates.repository';

const RATES_BACKLOG_ID = 'B-15';

export function createHttpRatesRepository(): RatesRepository {
  return {
    getRatesTable: () => Promise.reject(new NotImplementedYet(RATES_BACKLOG_ID)),
  };
}
