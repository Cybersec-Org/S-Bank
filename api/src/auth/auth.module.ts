import { Global, Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory.js';
import { MockAuthGuard } from './mock-auth.guard.js';
import { PoliciesGuard } from './policies.guard.js';
import { PartnerAuthGuard } from './partner-auth.guard.js';
import { PartnerPermissionsGuard } from './partner-permissions.guard.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { UserAuthGuard } from './user-auth.guard.js';

@Global()
@Module({
  providers: [
    CaslAbilityFactory,
    MockAuthGuard,
    PoliciesGuard,
    PartnerAuthGuard,
    PartnerPermissionsGuard,
    JwtAuthGuard,
    UserAuthGuard,
  ],
  exports: [
    CaslAbilityFactory,
    MockAuthGuard,
    PoliciesGuard,
    PartnerAuthGuard,
    PartnerPermissionsGuard,
    JwtAuthGuard,
    UserAuthGuard,
  ],
})
export class AuthModule {}
