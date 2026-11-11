import { Module } from '@nestjs/common';
import { PartnersController } from './partners.controller.js';

@Module({
  controllers: [PartnersController],
})
export class PartnersModule {}
