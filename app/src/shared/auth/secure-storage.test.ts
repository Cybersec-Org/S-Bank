import type * as SecureStorageModule from './secure-storage';

// jest.setup.ts loads secure-storage.ts (through renderWithProviders → session-store) with the real
// expo-secure-store, so this file loads its own copy in an isolated registry, against one shared mock object.
const mockSecureStore = {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(() => Promise.resolve('stored')),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
};
jest.mock('expo-secure-store', () => mockSecureStore);

let secureStorage: (typeof SecureStorageModule)['secureStorage'];
beforeAll(() => {
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    secureStorage = (require('./secure-storage') as typeof SecureStorageModule).secureStorage;
  });
});

describe('native secure storage', () => {
  const expectedOptions: unknown = expect.objectContaining({
    requireAuthentication: true,
    keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  });

  it('reads with biometric authentication and device-bound accessibility', async () => {
    const value = await secureStorage.getItem('sbank.refresh-token');

    expect(value).toBe('stored');
    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
      'sbank.refresh-token',
      expectedOptions,
    );
  });

  it('writes with biometric authentication and device-bound accessibility', async () => {
    await secureStorage.setItem('sbank.refresh-token', 'value');

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      'sbank.refresh-token',
      'value',
      expectedOptions,
    );
  });

  it('deletes with the same options so the entry is actually found', async () => {
    await secureStorage.deleteItem('sbank.refresh-token');

    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'sbank.refresh-token',
      expectedOptions,
    );
  });
});
