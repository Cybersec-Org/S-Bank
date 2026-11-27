import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';

import { BiometricCancelled } from './biometric-errors';
import { biometricPreference } from './biometric-preference';
import { deviceSecureStorage, secureStorage } from './secure-storage';
import { SECURE_STORAGE_KEYS } from './secure-storage.types';

/**
 * Refresh token kept across restarts behind biometrics (P-18, B-14, B-21, SR-09).
 *
 * - `K`, a random AES-256 key, lives in Keychain / Keystore *with* biometric authentication: reading it shows the
 *   system prompt, and changing the enrolled biometrics invalidates it.
 * - The current refresh token is AES-GCM encrypted with `K` and stored in Keychain / Keystore *without* a prompt, so
 *   it can be replaced after every rotation (Keycloak rotates on each refresh). Without `K` it is useless.
 * - During a session `K` stays in memory next to the refresh token; nothing here touches AsyncStorage except the
 *   `enabled` flag.
 */
export type VaultKey = AESEncryptionKey;

export { BiometricCancelled } from './biometric-errors';

export interface UnlockedVault {
  readonly key: VaultKey;
  readonly refreshToken: string;
}

export interface BiometricVault {
  /** Strong biometrics enrolled on this device (what Keystore / Keychain need for `requireAuthentication`). */
  isAvailable: () => Promise<boolean>;
  /** The user turned biometric unlock on and the entries should exist. */
  isEnabled: () => Promise<boolean>;
  /** Creates `K` behind biometrics, stores the sealed token and sets the flag. Returns `K` for this session. */
  enable: (refreshToken: string) => Promise<VaultKey>;
  /** Replaces the sealed token after a rotation; no prompt. */
  seal: (key: VaultKey, refreshToken: string) => Promise<void>;
  /**
   * Reads `K` (biometric prompt) and opens the sealed token. `null` = nothing usable (key invalidated by a biometric
   * change, entries missing or damaged) – the caller clears the vault. Throws `BiometricCancelled` on cancel.
   */
  unlock: () => Promise<UnlockedVault | null>;
  /** Deletes both entries and the flag. */
  clear: () => Promise<void>;
}

/**
 * Plaintext and associated data go to expo-crypto as base64 strings (`btoa` / `atob`). A refresh token is a JWT –
 * ASCII only – so `btoa` is safe; anything else makes `btoa` throw and enabling fails visibly.
 */
const ADDITIONAL_DATA = btoa('sbank.refresh-token.v1');

async function sealToken(key: VaultKey, refreshToken: string): Promise<string> {
  const sealed = await aesEncryptAsync(btoa(refreshToken), key, {
    additionalData: ADDITIONAL_DATA,
  });
  return sealed.combined('base64');
}

/**
 * Android's native `fromCombined` accepts only bytes: a base64 string – allowed by the TypeScript type – fails there
 * with a conversion error, which made every stored session unreadable on the phone.
 */
function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function openToken(key: VaultKey, sealedBase64: string): Promise<string> {
  const sealed = AESSealedData.fromCombined(base64ToBytes(sealedBase64));
  const plainBase64 = await aesDecryptAsync(sealed, key, {
    additionalData: ADDITIONAL_DATA,
    output: 'base64',
  });
  return atob(plainBase64);
}

async function deleteAll(): Promise<void> {
  await Promise.all([
    secureStorage.deleteItem(SECURE_STORAGE_KEYS.biometricKey).catch(() => undefined),
    deviceSecureStorage.deleteItem(SECURE_STORAGE_KEYS.sealedRefreshToken).catch(() => undefined),
  ]);
}

export const biometricVault: BiometricVault = {
  isAvailable: async () => {
    try {
      const [hardware, enrolled, level] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.getEnrolledLevelAsync(),
      ]);
      return hardware && enrolled && level >= LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG;
    } catch {
      return false;
    }
  },
  isEnabled: () => biometricPreference.isEnabled(),
  enable: async (refreshToken) => {
    await deleteAll();
    const key = await AESEncryptionKey.generate(256);
    await secureStorage.setItem(SECURE_STORAGE_KEYS.biometricKey, await key.encoded('base64'));
    await deviceSecureStorage.setItem(
      SECURE_STORAGE_KEYS.sealedRefreshToken,
      await sealToken(key, refreshToken),
    );
    await biometricPreference.setEnabled(true);
    return key;
  },
  seal: async (key, refreshToken) => {
    await deviceSecureStorage.setItem(
      SECURE_STORAGE_KEYS.sealedRefreshToken,
      await sealToken(key, refreshToken),
    );
  },
  unlock: async () => {
    let encodedKey: string | null;
    try {
      encodedKey = await secureStorage.getItem(SECURE_STORAGE_KEYS.biometricKey);
    } catch {
      throw new BiometricCancelled();
    }
    const sealed = await deviceSecureStorage
      .getItem(SECURE_STORAGE_KEYS.sealedRefreshToken)
      .catch(() => null);
    if (encodedKey === null || sealed === null) {
      return null;
    }
    try {
      const key = await AESEncryptionKey.import(encodedKey, 'base64');
      return { key, refreshToken: await openToken(key, sealed) };
    } catch {
      return null;
    }
  },
  clear: async () => {
    await deleteAll();
    await biometricPreference.setEnabled(false);
  },
};
