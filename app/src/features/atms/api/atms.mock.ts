import { mockUuid } from '@/shared/api/mock/mock-data';
import {
  createMockRunner,
  resolveMockOptions,
  type MockOptions,
} from '@/shared/api/mock/mock-runner';

import type { Atm } from '../model/atm';
import type { AtmsRepository } from './atms.repository';

/** Fictional locations; the distances stand in for the ones computed on the device from a location. */
const MOCK_ATMS: readonly Atm[] = [
  {
    id: mockUuid(801),
    name: 'Bankomat S-Bank Rynek',
    address: 'ul. Przykładowa 1, Miasto Testowe',
    distanceMeters: 350,
  },
  {
    id: mockUuid(802),
    name: 'Bankomat S-Bank Dworzec',
    address: 'pl. Dworcowy 2, Miasto Testowe',
    distanceMeters: 820,
  },
  {
    id: mockUuid(803),
    name: 'Bankomat S-Bank Galeria',
    address: 'al. Demonstracyjna 15, Miasto Testowe',
    distanceMeters: 1_240,
  },
  {
    id: mockUuid(804),
    name: 'Bankomat S-Bank Uczelnia',
    address: 'ul. Wzorcowa 7, Miasto Testowe',
    distanceMeters: 2_960,
  },
];

export function createMockAtmsRepository(partialOptions?: Partial<MockOptions>): AtmsRepository {
  const runner = createMockRunner(resolveMockOptions(partialOptions));
  return {
    listAtms: () => runner.run(() => (runner.empty ? [] : MOCK_ATMS)),
  };
}
