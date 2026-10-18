import { SetMetadata } from '@nestjs/common';

export const STEP_UP_KEY = 'sbank:step-up';

/** Five minutes: long enough to finish a confirmation flow, short enough to be a fresh passkey proof. */
export const DEFAULT_STEP_UP_MAX_AGE_SECONDS = 300;

export interface StepUpOptions {
  /** Maximum age of the last interactive authentication (`auth_time`). */
  readonly maxAgeSeconds: number;
}

/** Requires `acr` 2 (passkey) and a fresh `auth_time`; verified by the API, never only by the app. */
export const RequireStepUp = (
  options: StepUpOptions = { maxAgeSeconds: DEFAULT_STEP_UP_MAX_AGE_SECONDS },
) => SetMetadata(STEP_UP_KEY, options);
