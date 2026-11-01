import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PublicModule } from './public/pubilc.module.js';

@Module({
  imports: [
    PrismaModule, 
    PublicModule
  ],
  controllers: [HealthController],
  providers: []
})
export class AppModule {}
