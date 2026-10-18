import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  resolveThrottleProfile,
  THROTTLE_PROFILE_KEY,
  THROTTLE_PROFILES,
  ThrottleProfile,
} from './throttle-profiles.js';

class SampleController {
  @ThrottleProfile('auth')
  loginRoute(): void {}

  @ThrottleProfile('transfers')
  transferRoute(): void {}

  plainRoute(): void {}
}

function contextFor(handler: () => void, path: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ path }) }),
    getHandler: () => handler,
    getClass: () => SampleController,
  } as unknown as ExecutionContext;
}

const sample = new SampleController();

describe('throttle profiles', () => {
  it('defines the four named profiles with stricter budgets than the default', () => {
    expect(Object.keys(THROTTLE_PROFILES)).toEqual(['default', 'public', 'auth', 'transfers']);
    expect(THROTTLE_PROFILES.public.limit).toBeLessThan(THROTTLE_PROFILES.default.limit);
    expect(THROTTLE_PROFILES.auth.limit).toBeLessThan(THROTTLE_PROFILES.public.limit);
    expect(THROTTLE_PROFILES.transfers.limit).toBeLessThan(THROTTLE_PROFILES.public.limit);
  });

  it('applies an explicit profile whatever the zone', () => {
    expect(resolveThrottleProfile(contextFor(sample.loginRoute, '/api/login'))).toBe('auth');
    expect(resolveThrottleProfile(contextFor(sample.transferRoute, '/api/transfers'))).toBe(
      'transfers',
    );
  });

  it('applies the public profile to routes in the public zone', () => {
    expect(resolveThrottleProfile(contextFor(sample.plainRoute, '/public/rates'))).toBe('public');
  });

  it.each(['/api/me', '/partner/x', '/unknown'])('applies the default profile to %s', (path) => {
    expect(resolveThrottleProfile(contextFor(sample.plainRoute, path))).toBe('default');
  });

  it('stores the profile under a stable metadata key', () => {
    expect(Reflect.getMetadata(THROTTLE_PROFILE_KEY, sample.loginRoute)).toBe('auth');
  });
});
