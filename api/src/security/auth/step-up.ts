import type { Principal } from './principal.js';
import type { StepUpOptions } from './step-up.decorator.js';

/** `acr` value Keycloak issues after a passkey (WebAuthn) authentication. */
export const STEP_UP_ACR = '2';

/** Tolerated clock difference between Keycloak and the API when comparing `auth_time` with now. */
export const CLOCK_TOLERANCE_SECONDS = 5;

/** Pure rule: a passkey authentication (`acr` 2) that is not older than `maxAgeSeconds`. */
export function isStepUpSatisfied(
  principal: Principal,
  options: StepUpOptions,
  nowSeconds: number,
): boolean {
  if (principal.acr !== STEP_UP_ACR || principal.authTime === undefined) {
    return false;
  }
  const ageSeconds = nowSeconds - principal.authTime;
  return ageSeconds >= -CLOCK_TOLERANCE_SECONDS && ageSeconds <= options.maxAgeSeconds;
}
