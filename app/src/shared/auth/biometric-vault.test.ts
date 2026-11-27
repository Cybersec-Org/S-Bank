import AsyncStorage from '@react-native-async-storage/async-storage';

import type * as VaultModule from './biometric-vault';
import { SECURE_STORAGE_KEYS } from './secure-storage.types';

/** Keychain / Keystore stand-in: entries are kept apart by whether they need biometric authentication. */
interface Entry {
  readonly value: string;
  readonly requireAuthentication: boolean;
}
const mockKeychain = new Map<string, Entry>();
const mockSecureStore = {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn((key: string, options?: { requireAuthentication?: boolean }) => {
    const entry = mockKeychain.get(key);
    if (
      entry === undefined ||
      entry.requireAuthentication !== (options?.requireAuthentication ?? false)
    ) {
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.value);
  }),
  setItemAsync: jest.fn(
    (key: string, value: string, options?: { requireAuthentication?: boolean }) => {
      mockKeychain.set(key, {
        value,
        requireAuthentication: options?.requireAuthentication ?? false,
      });
      return Promise.resolve();
    },
  ),
  deleteItemAsync: jest.fn((key: string) => {
    mockKeychain.delete(key);
    return Promise.resolve();
  }),
};

/** AES stand-in: reversible and key-bound, enough to check what is stored where (the real AES-GCM is native). */
const mockAes = {
  AESEncryptionKey: {
    generate: jest.fn(() => Promise.resolve({ id: 'K1', encoded: () => Promise.resolve('K1') })),
    import: jest.fn((encoded: string) =>
      Promise.resolve({ id: encoded, encoded: () => Promise.resolve(encoded) }),
    ),
  },
  // Like Android's native module: `fromCombined` takes bytes only, a string throws a conversion error.
  AESSealedData: {
    fromCombined: (combined: unknown) => {
      if (!(combined instanceof Uint8Array)) {
        throw new TypeError('Cannot convert String to ByteArray');
      }
      return { combined: String.fromCharCode(...combined) };
    },
  },
  // A string input must be base64; `output: 'base64'` returns base64, otherwise bytes.
  aesEncryptAsync: jest.fn((plain: string | Uint8Array, key: { id: string }) => {
    const base64 = typeof plain === 'string' ? plain : btoa(String.fromCharCode(...plain));
    return Promise.resolve({ combined: () => Promise.resolve(btoa(`${key.id}:${base64}`)) });
  }),
  aesDecryptAsync: jest.fn(
    (sealed: { combined: string }, key: { id: string }, options?: { output?: string }) => {
      const [keyId, payload = ''] = sealed.combined.split(':');
      if (keyId !== key.id) {
        return Promise.reject(new Error('GCM tag mismatch'));
      }
      return Promise.resolve(
        options?.output === 'base64'
          ? payload
          : Uint8Array.from(atob(payload), (char) => char.charCodeAt(0)),
      );
    },
  ),
};

const mockLocalAuth = {
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  hasHardwareAsync: jest.fn(() => Promise.resolve(true)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(true)),
  getEnrolledLevelAsync: jest.fn(() => Promise.resolve(3)),
};

jest.mock('expo-secure-store', () => mockSecureStore);
jest.mock('expo-crypto', () => mockAes);
jest.mock('expo-local-authentication', () => mockLocalAuth);

let vault: (typeof VaultModule)['biometricVault'];
let BiometricCancelled: (typeof VaultModule)['BiometricCancelled'];

beforeAll(() => {
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('./biometric-vault') as typeof VaultModule;
    vault = module.biometricVault;
    BiometricCancelled = module.BiometricCancelled;
  });
});

beforeEach(async () => {
  mockKeychain.clear();
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

const TOKEN = 'refresh-token-secret';

describe('biometric vault (P-18)', () => {
  it('keeps the key behind biometrics and only an encrypted token without a prompt', async () => {
    await vault.enable(TOKEN);

    expect(mockKeychain.get(SECURE_STORAGE_KEYS.biometricKey)).toEqual({
      value: 'K1',
      requireAuthentication: true,
    });
    const sealed = mockKeychain.get(SECURE_STORAGE_KEYS.sealedRefreshToken);
    expect(sealed?.requireAuthentication).toBe(false);
    expect(sealed?.value).not.toContain(TOKEN);
    expect(await vault.isEnabled()).toBe(true);
  });

  it('writes nothing but flags to AsyncStorage', async () => {
    await vault.enable(TOKEN);

    const keys = await AsyncStorage.getAllKeys();
    const values = await AsyncStorage.multiGet(keys);
    expect(keys).toEqual(['sbank.biometrics-enabled']);
    expect(values.map(([, value]) => value)).toEqual(['true']);
  });

  it('opens the stored token after the biometric read of the key', async () => {
    await vault.enable(TOKEN);

    await expect(vault.unlock()).resolves.toMatchObject({ refreshToken: TOKEN });
    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
      SECURE_STORAGE_KEYS.biometricKey,
      expect.objectContaining({ requireAuthentication: true }),
    );
  });

  it('replaces the sealed token after a rotation, without a biometric prompt', async () => {
    const key = await vault.enable(TOKEN);
    mockSecureStore.setItemAsync.mockClear();

    await vault.seal(key, 'rotated-token');

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(mockSecureStore.setItemAsync.mock.calls[0]?.[2]?.requireAuthentication).toBeUndefined();
    await expect(vault.unlock()).resolves.toMatchObject({ refreshToken: 'rotated-token' });
  });

  it('returns nothing usable when the key was invalidated (biometrics changed)', async () => {
    await vault.enable(TOKEN);
    mockKeychain.delete(SECURE_STORAGE_KEYS.biometricKey);

    await expect(vault.unlock()).resolves.toBeNull();
  });

  it('returns nothing usable for a token sealed with another key', async () => {
    await vault.enable(TOKEN);
    mockKeychain.set(SECURE_STORAGE_KEYS.biometricKey, {
      value: 'K2',
      requireAuthentication: true,
    });

    await expect(vault.unlock()).resolves.toBeNull();
  });

  it('reports a cancelled prompt separately, keeping the entries', async () => {
    await vault.enable(TOKEN);
    mockSecureStore.getItemAsync.mockRejectedValueOnce(new Error('User canceled'));

    await expect(vault.unlock()).rejects.toBeInstanceOf(BiometricCancelled);
    expect(mockKeychain.size).toBe(2);
  });

  it('removes both entries and the flag on clear', async () => {
    await vault.enable(TOKEN);

    await vault.clear();

    expect(mockKeychain.size).toBe(0);
    expect(await vault.isEnabled()).toBe(false);
  });

  it('is unavailable without strong biometrics', async () => {
    mockLocalAuth.getEnrolledLevelAsync.mockResolvedValueOnce(2);
    await expect(vault.isAvailable()).resolves.toBe(false);

    mockLocalAuth.isEnrolledAsync.mockResolvedValueOnce(false);
    await expect(vault.isAvailable()).resolves.toBe(false);

    await expect(vault.isAvailable()).resolves.toBe(true);
  });
});
