/** Storage for secrets that must survive an app restart (B-14, B-21). */
export interface SecureStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  deleteItem: (key: string) => Promise<void>;
}

export const SECURE_STORAGE_KEYS = {
  /** Legacy (stage 9 and older): a plain refresh token; only ever deleted now. */
  refreshToken: 'sbank.refresh-token',
  /** P-18: AES-256 key that unlocks the stored refresh token; readable only after biometric authentication. */
  biometricKey: 'sbank.biometric-key',
  /** P-18: the current refresh token, AES-GCM encrypted with the biometric key (no prompt to write). */
  sealedRefreshToken: 'sbank.sealed-refresh-token',
} as const;
