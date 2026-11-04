import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PublicModule } from './public/pubilc.module.js';
import { AccountsModule } from './accounts/accounts.module.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [
    PrismaModule, 
    PublicModule,
    AccountsModule,
    AuthModule
  ],
  controllers: [HealthController],
  providers: []
})
export class AppModule {}
