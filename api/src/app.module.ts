import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PublicModule } from './public/pubilc.module.js';
import { AccountsModule } from './accounts/accounts.module.js';

@Module({
  imports: [
    PrismaModule, 
    PublicModule,
    AccountsModule
  ],
  controllers: [HealthController],
  providers: []
})
export class AppModule {}
