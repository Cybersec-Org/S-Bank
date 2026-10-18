import { ApiProblem } from '@/shared/api/problem';
import { MOCK_NOW_ISO, mockUuid } from '@/shared/api/mock/mock-data';
import {
  createMockRunner,
  resolveMockOptions,
  type MockOptions,
} from '@/shared/api/mock/mock-runner';

import type { Passkey, SecuritySettings } from '../model/settings';
import type { SettingsRepository } from './settings.repository';

const HTTP_NOT_FOUND = 404;
const FIRST_NEW_PASSKEY_SEQUENCE = 1_100;

export function createMockSettingsRepository(
  partialOptions?: Partial<MockOptions>,
): SettingsRepository {
  const runner = createMockRunner(resolveMockOptions(partialOptions));
  let security: SecuritySettings = { biometricsEnabled: false };
  let passkeys: readonly Passkey[] = [
    { id: mockUuid(1_001), label: 'Telefon (MOCK)', createdAt: '2026-09-01T10:00:00.000Z' },
  ];
  let nextSequence = FIRST_NEW_PASSKEY_SEQUENCE;

  return {
    getSecuritySettings: () => runner.run(() => security),
    setBiometricsEnabled: (enabled) =>
      runner.run(() => {
        security = { biometricsEnabled: enabled };
        return security;
      }),
    listPasskeys: () => runner.run(() => (runner.empty ? [] : passkeys)),
    addPasskey: () =>
      runner.run(() => {
        nextSequence += 1;
        const created: Passkey = {
          id: mockUuid(nextSequence),
          label: `Klucz dostępu ${passkeys.length + 1} (MOCK)`,
          createdAt: MOCK_NOW_ISO,
        };
        passkeys = [...passkeys, created];
        return created;
      }),
    removePasskey: (passkeyId) =>
      runner.run(() => {
        if (!passkeys.some((passkey) => passkey.id === passkeyId)) {
          throw new ApiProblem({ status: HTTP_NOT_FOUND });
        }
        passkeys = passkeys.filter((passkey) => passkey.id !== passkeyId);
      }),
  };
}
