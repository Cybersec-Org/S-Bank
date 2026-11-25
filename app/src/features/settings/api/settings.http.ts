import type { SettingsRepository } from './settings.repository';

export function createHttpSettingsRepository(): SettingsRepository {
  let biometricsEnabled = false;
  return {
    getSecuritySettings: () => Promise.resolve({ biometricsEnabled }),
    setBiometricsEnabled: (enabled) => {
      biometricsEnabled = enabled;
      return Promise.resolve({ biometricsEnabled });
    },
    listPasskeys: () => Promise.resolve([]),
    addPasskey: () => Promise.reject(new Error('Use Keycloak passkey registration in live mode')),
    removePasskey: () => Promise.resolve(),
  };
}
