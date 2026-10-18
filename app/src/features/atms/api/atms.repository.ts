import type { Atm } from '../model/atm';

export interface AtmsRepository {
  listAtms: () => Promise<readonly Atm[]>;
}
