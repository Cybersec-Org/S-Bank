import type { SecureStorage } from './secure-storage.types';

/**
 * Web implementation: a module-level Map, so values vanish on reload. Browsers have no storage that is
 * safe for tokens, hence nothing goes to localStorage, sessionStorage or cookies (SR-09).
 */
const memory = new Map<string, string>();

export const secureStorage: SecureStorage = {
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
