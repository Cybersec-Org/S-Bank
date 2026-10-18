import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { resolveThrottleProfile, THROTTLE_PROFILES } from './throttle-profiles.js';

/**
 * Every named throttler runs on every route in `@nestjs/throttler`, so each one skips requests
 * that belong to another profile.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot(
      Object.entries(THROTTLE_PROFILES).map(([name, budget]) => ({
        name,
        ...budget,
        skipIf: (context) => resolveThrottleProfile(context) !== name,
      })),
    ),
  ],
  exports: [ThrottlerModule],
})
export class ThrottlingModule {}
