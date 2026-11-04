import { Global, Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory.js';
import { MockAuthGuard } from './mock-auth.guard.js';
import { PoliciesGuard } from './policies.guard.js';

@Global()
@Module({
  providers: [CaslAbilityFactory, MockAuthGuard, PoliciesGuard],
  exports: [CaslAbilityFactory, MockAuthGuard, PoliciesGuard],
})
export class AuthModule {}