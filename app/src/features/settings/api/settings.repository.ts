import type { Passkey, SecuritySettings } from '../model/settings';

export interface SettingsRepository {
  getSecuritySettings: () => Promise<SecuritySettings>;
  setBiometricsEnabled: (enabled: boolean) => Promise<SecuritySettings>;
  listPasskeys: () => Promise<readonly Passkey[]>;
  addPasskey: () => Promise<Passkey>;
  removePasskey: (passkeyId: string) => Promise<void>;
}
