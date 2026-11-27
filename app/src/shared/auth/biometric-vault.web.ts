import type { BiometricVault, UnlockedVault, VaultKey } from './biometric-vault';

export { BiometricCancelled } from './biometric-errors';
export type { BiometricVault, UnlockedVault, VaultKey } from './biometric-vault';

/** Web: no biometric unlock – the refresh token lives only in memory and a reload means a new sign-in (SR-09). */
const unavailable = (): Promise<never> =>
  Promise.reject(new Error('Biometric unlock is not available on the web'));

export const biometricVault: BiometricVault = {
  isAvailable: () => Promise.resolve(false),
  isEnabled: () => Promise.resolve(false),
  enable: (_refreshToken: string): Promise<VaultKey> => unavailable(),
  seal: (_key: VaultKey, _refreshToken: string): Promise<void> => Promise.resolve(),
  unlock: (): Promise<UnlockedVault | null> => Promise.resolve(null),
  clear: () => Promise.resolve(),
};
