import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PublicService } from './public.service.js';

@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('rates')
  @ApiOperation({ summary: 'Get current NBP exchange rates table' })
  async getRates() {
    return this.publicService.getExchangeRates();
  }

  @Get('convert')
  @ApiOperation({ summary: 'Convert amount between any supported currencies' })
  @ApiQuery({ name: 'amount', example: 100, required: true })
  @ApiQuery({ name: 'from', example: 'PLN', required: false })
  @ApiQuery({ name: 'to', example: 'EUR', required: false })
  async convertCurrency(
    @Query('amount') amountStr: string,
    @Query('from') from: string = 'PLN',
    @Query('to') to: string = 'EUR',
  ) {
    const amount = Number(amountStr);
    if (!amountStr || isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Please provide a valid positive amount (amount > 0)');
    }

    return this.publicService.convertCurrency(amount, from, to);
  }
}