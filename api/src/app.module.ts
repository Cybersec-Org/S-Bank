import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PublicModule } from './public/pubilc.module.js';
import { AccountsModule } from './accounts/accounts.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PartnersModule } from './partners/partners.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule, 
    PublicModule,
    AccountsModule,
    AuthModule,
    PartnersModule
  ],
  controllers: [HealthController],
  providers: []
})
export class AppModule {}
