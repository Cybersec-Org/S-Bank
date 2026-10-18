import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CLOCK, SystemClock } from '../common/clock.js';
import { AuthGuard } from './auth/auth.guard.js';
import { FailClosedTokenVerifier } from './auth/fail-closed-token-verifier.js';
import { TOKEN_VERIFIER } from './auth/token-verifier.js';
import { AbilityFactory } from './authz/ability.factory.js';
import { RateLimitGuard } from './throttling/rate-limit.guard.js';
import { ThrottlingModule } from './throttling/throttling.module.js';

/** Global guards, in order: rate limiting first (cheap, protects token verification), then access control. */
@Module({
  imports: [ThrottlingModule],
  providers: [
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: TOKEN_VERIFIER, useClass: FailClosedTokenVerifier },
    { provide: CLOCK, useClass: SystemClock },
    AbilityFactory,
  ],
  exports: [AbilityFactory, TOKEN_VERIFIER, CLOCK],
})
export class SecurityModule {}
