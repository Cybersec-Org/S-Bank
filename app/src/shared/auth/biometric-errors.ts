/** The user cancelled (or failed) the biometric prompt: keep everything, let them retry or sign in normally. */
export class BiometricCancelled extends Error {
  constructor() {
    super('Biometric authentication cancelled');
    this.name = 'BiometricCancelled';
  }
}
