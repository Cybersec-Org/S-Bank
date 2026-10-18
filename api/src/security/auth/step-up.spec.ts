import { describe, expect, it } from 'vitest';
import { buildPrincipal, FIXED_NOW_SECONDS } from '../../../test/helpers/factories.js';
import type { Principal } from './principal.js';
import { CLOCK_TOLERANCE_SECONDS, isStepUpSatisfied } from './step-up.js';

const FIVE_MINUTES = { maxAgeSeconds: 300 };

describe('isStepUpSatisfied', () => {
  it('accepts a passkey authentication that is recent enough', () => {
    const principal = buildPrincipal({ acr: '2', authTime: FIXED_NOW_SECONDS - 120 });

    expect(isStepUpSatisfied(principal, FIVE_MINUTES, FIXED_NOW_SECONDS)).toBe(true);
  });

  it('accepts an authentication exactly at the maximum age', () => {
    const principal = buildPrincipal({ acr: '2', authTime: FIXED_NOW_SECONDS - 300 });

    expect(isStepUpSatisfied(principal, FIVE_MINUTES, FIXED_NOW_SECONDS)).toBe(true);
  });

  it('rejects an authentication one second past the maximum age', () => {
    const principal = buildPrincipal({ acr: '2', authTime: FIXED_NOW_SECONDS - 301 });

    expect(isStepUpSatisfied(principal, FIVE_MINUTES, FIXED_NOW_SECONDS)).toBe(false);
  });

  it.each(['1', '0', '3', 'passkey', ''])('rejects acr %j', (acr) => {
    const principal = buildPrincipal({ acr, authTime: FIXED_NOW_SECONDS });

    expect(isStepUpSatisfied(principal, FIVE_MINUTES, FIXED_NOW_SECONDS)).toBe(false);
  });

  it('rejects a token without acr', () => {
    const withoutAcr: Principal = {
      subject: 'subject-1',
      roles: ['customer'],
      authTime: FIXED_NOW_SECONDS,
    };

    expect(isStepUpSatisfied(withoutAcr, FIVE_MINUTES, FIXED_NOW_SECONDS)).toBe(false);
  });

  it('rejects a token without auth_time', () => {
    const withoutAuthTime: Principal = { subject: 'subject-1', roles: ['customer'], acr: '2' };

    expect(isStepUpSatisfied(withoutAuthTime, FIVE_MINUTES, FIXED_NOW_SECONDS)).toBe(false);
  });

  it('tolerates small clock skew but not an auth_time far in the future', () => {
    const slightlyAhead = buildPrincipal({
      acr: '2',
      authTime: FIXED_NOW_SECONDS + CLOCK_TOLERANCE_SECONDS,
    });
    const farAhead = buildPrincipal({
      acr: '2',
      authTime: FIXED_NOW_SECONDS + CLOCK_TOLERANCE_SECONDS + 1,
    });

    expect(isStepUpSatisfied(slightlyAhead, FIVE_MINUTES, FIXED_NOW_SECONDS)).toBe(true);
    expect(isStepUpSatisfied(farAhead, FIVE_MINUTES, FIXED_NOW_SECONDS)).toBe(false);
  });
});
