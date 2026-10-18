import * as SecureStore from 'expo-secure-store';

import { pl } from '@/shared/i18n/pl';

import type { SecureStorage } from './secure-storage.types';

/**
 * Native implementation: Keychain / Keystore entries that need biometric authentication and are
 * never migrated to another device or restored from a backup (MASVS-STORAGE, SR-09).
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: pl.secureStorage.authenticationPrompt,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const secureStorage: SecureStorage = {
  getItem: (key) => SecureStore.getItemAsync(key, OPTIONS),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, OPTIONS),
  deleteItem: (key) => SecureStore.deleteItemAsync(key, OPTIONS),
};
