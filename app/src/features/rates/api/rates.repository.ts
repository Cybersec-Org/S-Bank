import type { RatesTable } from '../model/rate';

export interface RatesRepository {
  getRatesTable: () => Promise<RatesTable>;
}
