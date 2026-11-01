import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PublicService } from './public.service.js';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('rates')
  async getRates() {
    return this.publicService.getExchangeRates();
  }

  @Get('convert')
  async convertCurrency(
    @Query('amount') amountStr: string,
    @Query('from') from: string = 'PLN',
    @Query('to') to: string = 'EUR',
  ) {
    const amount = Number(amountStr);
    if (!amountStr || isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Enter a valid amount (amount > 0)');
    }

    return this.publicService.convertCurrency(amount, from, to);
  }
}