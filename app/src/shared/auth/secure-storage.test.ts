import * as SecureStore from 'expo-secure-store';

import { secureStorage } from './secure-storage';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(() => Promise.resolve('stored')),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

describe('native secure storage', () => {
  const expectedOptions: unknown = expect.objectContaining({
    requireAuthentication: true,
    keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  });

  it('reads with biometric authentication and device-bound accessibility', async () => {
    const value = await secureStorage.getItem('sbank.refresh-token');

    expect(value).toBe('stored');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('sbank.refresh-token', expectedOptions);
  });

  it('writes with biometric authentication and device-bound accessibility', async () => {
    await secureStorage.setItem('sbank.refresh-token', 'value');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'sbank.refresh-token',
      'value',
      expectedOptions,
    );
  });

  it('deletes with the same options so the entry is actually found', async () => {
    await secureStorage.deleteItem('sbank.refresh-token');

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'sbank.refresh-token',
      expectedOptions,
    );
  });
});
