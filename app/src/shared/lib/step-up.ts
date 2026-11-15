/**
 * UX mirror of the server rule (SR-03): the API checks `acr` and `auth_time` itself and is the only
 * authority. The app uses the threshold to explain the step-up before the user hits it.
 */
export const STEP_UP_THRESHOLD_GROSZE = 100_000;

export function amountRequiresStepUp(amountGrosze: number): boolean {
  return amountGrosze >= STEP_UP_THRESHOLD_GROSZE;
}
