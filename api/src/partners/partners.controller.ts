import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';

import { PartnerAuthGuard } from '../auth/partner-auth.guard.js';
import { PartnerPermissionsGuard } from '../auth/partner-permissions.guard.js';
import { RequirePartnerPermissions } from '../auth/partner-permissions.decorator.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { CreatePaymentRequestDto } from '../accounts/dto/extra.dto.js';
import type { PartnerRequest } from '../auth/interfaces/partner-request.interface.js';
import { PaymentRequestDto, PartnerPaymentRequestCreatedDto } from '../accounts/dto/responses.dto.js';
import { PartnerTestDto } from '../public/dto/responses.dto.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';

@ApiTags('Partner mTLS API')
@ApiHeader({ name: 'x-partner-id', description: 'Partner ID (partner1, partner2)', required: true })
@ApiHeader({ name: 'x-client-cert-sha256', description: 'Optional mTLS certificate thumbprint (RFC 8705)', required: false })
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Request did not come through Caddy mTLS or the partner is unknown' })
@ApiForbiddenResponse({ type: ErrorResponseDto, description: 'Partner lacks the required permission' })
@Controller('api')
@UseGuards(PartnerAuthGuard, PartnerPermissionsGuard)
export class PartnersController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('payments/test')
  @RequirePartnerPermissions('payments:read')
  @ApiOperation({ summary: 'Test endpoint for partner payments:read permission' })
  @ApiOkResponse({ type: PartnerTestDto })
  getPayments(@Req() req: PartnerRequest) {
    return {
      message: 'Payments endpoint accessible',
      partner: req.partner.id,
    };
  }

  @Get('reports/test')
  @RequirePartnerPermissions('reports:read')
  @ApiOperation({ summary: 'Test endpoint for partner reports:read permission' })
  @ApiOkResponse({ type: PartnerTestDto })
  getReports(@Req() req: PartnerRequest) {
    return {
      message: 'Reports endpoint accessible',
      partner: req.partner.id,
    };
  } 

  @Post('payment-requests')
  @RequirePartnerPermissions('payments:create')
  @ApiOperation({ summary: 'Create a payment request for QR code / deep link sbank://pay/{id}' })
  @ApiCreatedResponse({ type: PartnerPaymentRequestCreatedDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Validation error' })
  async createPaymentRequest(@Body() dto: CreatePaymentRequestDto, @Req() req: PartnerRequest) {
    return this.accountsService.createPartnerPaymentRequest(req.partner.id, dto);
  }

  @Get('payment-requests/:id')
  @RequirePartnerPermissions('payments:read')
  @ApiOperation({ summary: 'Get status of own payment request (BOLA 404 protected between partners)' })
  @ApiOkResponse({ type: PaymentRequestDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'PAYMENT_REQUEST_NOT_FOUND (also for requests of other partners)' })
  async getPaymentRequest(@Param('id') id: string, @Req() req: PartnerRequest) {
    return this.accountsService.getPartnerPaymentRequest(req.partner.id, id);
  }
}
