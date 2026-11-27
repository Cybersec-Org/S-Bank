import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Device preferences in AsyncStorage – flags only, never tokens or personal data (BASIM4 D3, SR-09):
 * - `enabled`: the user turned biometric unlock on (P-18 entries exist in Keychain / Keystore);
 * - `asked`: the opt-in question was answered ("Not now" or enabled), so it is not shown again – until a sign-out
 *   removes a stored session, then the next sign-in offers it again.
 */
const ENABLED_KEY = 'sbank.biometrics-enabled';
const ASKED_KEY = 'sbank.biometrics-asked';

async function readFlag(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === 'true';
  } catch {
    return false;
  }
}

export const biometricPreference = {
  isEnabled: () => readFlag(ENABLED_KEY),
  setEnabled: async (enabled: boolean): Promise<void> => {
    if (enabled) {
      await AsyncStorage.setItem(ENABLED_KEY, 'true');
    } else {
      await AsyncStorage.removeItem(ENABLED_KEY);
    }
  },
  wasAsked: () => readFlag(ASKED_KEY),
  markAsked: () => AsyncStorage.setItem(ASKED_KEY, 'true'),
  /** After a sign-out removed a stored session: offer it again at the next sign-in. */
  resetAsked: () => AsyncStorage.removeItem(ASKED_KEY),
};

export type BiometricPreference = typeof biometricPreference;
