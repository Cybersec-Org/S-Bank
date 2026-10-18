/** Storage for secrets that must survive an app restart (the refresh token, B-14). */
export interface SecureStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  deleteItem: (key: string) => Promise<void>;
}

export const SECURE_STORAGE_KEYS = {
  refreshToken: 'sbank.refresh-token',
} as const;
