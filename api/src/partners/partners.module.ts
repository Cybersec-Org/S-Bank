import { Module } from '@nestjs/common';
import { PartnersController } from './partners.controller.js';
import { AccountsModule } from '../accounts/accounts.module.js';

@Module({
  imports: [AccountsModule],
  controllers: [PartnersController],
})
export class PartnersModule {}