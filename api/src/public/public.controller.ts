import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicService } from './public.service.js';
import {
  SignatureService,
  type TransferConfirmationPayload,
} from '../auth/signature.service.js';
import { Public } from '../auth/policies.guard.js';
import { RatesDto, ConversionDto, AtmsDto, TermsDto, PublicKeyDto, VerifyConfirmationRequestDto, VerifyConfirmationResultDto } from './dto/responses.dto.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';

@Public()
@ApiTags('Public')
@Throttle({ default: { limit: 30, ttl: 60000 } })
@Controller('public')
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly signatureService: SignatureService,
  ) {}

  @Get('rates')
  @ApiOperation({ summary: 'Get current NBP exchange rates table' })
  @ApiOkResponse({ type: RatesDto })
  async getRates() {
    return this.publicService.getExchangeRates();
  }

  @Get('convert')
  @ApiOperation({ summary: 'Convert amount between any supported currencies' })
  @ApiQuery({ name: 'amount', example: 100, required: true })
  @ApiQuery({ name: 'from', example: 'PLN', required: false })
  @ApiQuery({ name: 'to', example: 'EUR', required: false })
  @ApiOkResponse({ type: ConversionDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Invalid amount or unsupported currency' })
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

  @Get('atms')
  @ApiOperation({
    summary: 'Get ATM locations for map display and local GPS sorting (OpenStreetMap Overpass API)',
  })
  @ApiQuery({
    name: 'city',
    required: false,
    example: 'Katowice',
    description: 'Optional city name (e.g. Katowice, Dąbrowa Górnicza, Gliwice, Warszawa, Kraków)',
  })
  @ApiOkResponse({ type: AtmsDto })
  async getAtms(@Query('city') city?: string) {
    return this.publicService.getAtms(city);
  }

  @Get('terms')
  @ApiOperation({ summary: 'Get static HTML terms and conditions for secure WebView' })
  @ApiOkResponse({ type: TermsDto })
  getTerms() {
    return this.publicService.getTerms();
  }

  @Get('keys')
  @ApiOperation({ summary: 'Get bank public key (PEM) for verifying transfer confirmations' })
  @ApiOkResponse({ type: PublicKeyDto })
  getPublicKeys() {
    return this.signatureService.getPublicKeyInfo();
  }

  @Post('verify-confirmation')
  @ApiOperation({ summary: 'Verify cryptographic signature of a transfer confirmation' })
  @ApiBody({ type: VerifyConfirmationRequestDto })
  @ApiCreatedResponse({ type: VerifyConfirmationResultDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'payload or signature missing' })
  verifyConfirmation(
    @Body() body: { payload: TransferConfirmationPayload; signature: string },
  ) {
    if (!body?.payload || !body?.signature) {
      throw new BadRequestException('Both payload and signature are required');
    }
    const valid = this.signatureService.verifyTransferConfirmation(body.payload, body.signature);
    return { valid };
  }
}
