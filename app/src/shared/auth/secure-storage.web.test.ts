import { secureStorage as webSecureStorage } from './secure-storage.web';

describe('web secure storage', () => {
  it('keeps values in memory and returns null for unknown keys', async () => {
    await webSecureStorage.setItem('sbank.refresh-token', 'value');

    await expect(webSecureStorage.getItem('sbank.refresh-token')).resolves.toBe('value');
    await expect(webSecureStorage.getItem('missing')).resolves.toBeNull();
  });

  it('forgets a deleted value', async () => {
    await webSecureStorage.setItem('k', 'v');

    await webSecureStorage.deleteItem('k');

    await expect(webSecureStorage.getItem('k')).resolves.toBeNull();
  });
});
