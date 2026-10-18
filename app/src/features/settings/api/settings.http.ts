import { NotImplementedYet } from '@/shared/api/not-implemented';

import type { SettingsRepository } from './settings.repository';

const BIOMETRICS_BACKLOG_ID = 'B-21';
const PASSKEYS_BACKLOG_ID = 'B-20';

export function createHttpSettingsRepository(): SettingsRepository {
  return {
    getSecuritySettings: () => Promise.reject(new NotImplementedYet(BIOMETRICS_BACKLOG_ID)),
    setBiometricsEnabled: () => Promise.reject(new NotImplementedYet(BIOMETRICS_BACKLOG_ID)),
    listPasskeys: () => Promise.reject(new NotImplementedYet(PASSKEYS_BACKLOG_ID)),
    addPasskey: () => Promise.reject(new NotImplementedYet(PASSKEYS_BACKLOG_ID)),
    removePasskey: () => Promise.reject(new NotImplementedYet(PASSKEYS_BACKLOG_ID)),
  };
}
