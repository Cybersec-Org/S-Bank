import { STEP_UP_THRESHOLD_GROSZE, amountRequiresStepUp } from './transfer';

describe('amountRequiresStepUp', () => {
  it('uses a threshold of 1 000 zł in grosze', () => {
    expect(STEP_UP_THRESHOLD_GROSZE).toBe(100_000);
  });

  it('requires step-up from exactly the threshold', () => {
    expect(amountRequiresStepUp(99_999)).toBe(false);
    expect(amountRequiresStepUp(100_000)).toBe(true);
    expect(amountRequiresStepUp(100_001)).toBe(true);
  });
});
