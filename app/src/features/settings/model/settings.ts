// B-20 (passkeys) and B-21 (biometrics): switch to the generated schema types / real device APIs.
export interface Passkey {
  readonly id: string;
  readonly label: string;
  readonly createdAt: string;
}

export interface SecuritySettings {
  readonly biometricsEnabled: boolean;
}
