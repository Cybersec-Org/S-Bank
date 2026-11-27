import type { SecureStorage } from './secure-storage.types';

/**
 * Web implementation: module-level Maps, so values vanish on reload. Browsers have no storage that is
 * safe for tokens, hence nothing goes to localStorage, sessionStorage or cookies (SR-09). Biometric unlock is not
 * offered on the web, so in practice nothing is written here.
 */
function memoryStorage(): SecureStorage {
  const memory = new Map<string, string>();
  return {
    getItem: (key) => Promise.resolve(memory.get(key) ?? null),
    setItem: (key, value) => {
      memory.set(key, value);
      return Promise.resolve();
    },
    deleteItem: (key) => {
      memory.delete(key);
      return Promise.resolve();
    },
  };
}

export const secureStorage: SecureStorage = memoryStorage();
export const deviceSecureStorage: SecureStorage = memoryStorage();
