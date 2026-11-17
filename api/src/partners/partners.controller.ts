import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PartnerAuthGuard } from '../auth/partner-auth.guard.js';
import { PartnerPermissionsGuard } from '../auth/partner-permissions.guard.js';
import { RequirePartnerPermissions } from '../auth/partner-permissions.decorator.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { CreatePaymentRequestDto } from '../accounts/dto/extra.dto.js';

@ApiTags('Partner mTLS API')
@ApiHeader({ name: 'x-partner-id', description: 'Partner ID (partner1, partner2)', required: true })
@ApiHeader({ name: 'x-client-cert-sha256', description: 'Optional mTLS certificate thumbprint (RFC 8705)', required: false })
@Controller('api')
@UseGuards(PartnerAuthGuard, PartnerPermissionsGuard)
export class PartnersController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('payments/test')
  @RequirePartnerPermissions('payments:read')
  @ApiOperation({ summary: 'Test endpoint for partner1 payments:read permission' })
  getPayments() {
    return {
      message: 'Payments endpoint accessible',
      partner: 'partner1',
    };
  }

  @Get('reports/test')
  @RequirePartnerPermissions('reports:read')
  @ApiOperation({ summary: 'Test endpoint for partner2 reports:read permission' })
  getReports() {
    return {
      message: 'Reports endpoint accessible',
      partner: 'partner2',
    };
  }

  @Post('payment-requests')
  @RequirePartnerPermissions('payments:create')
  @ApiOperation({ summary: 'Create a payment request for QR code / deep link sbank://pay/{id}' })
  async createPaymentRequest(@Body() dto: CreatePaymentRequestDto, @Req() req: any) {
    return this.accountsService.createPartnerPaymentRequest(req.partner.id, dto);
  }

  @Get('payment-requests/:id')
  @RequirePartnerPermissions('payments:read')
  @ApiOperation({ summary: 'Get status of own payment request (BOLA 404 protected between partners)' })
  async getPaymentRequest(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.getPartnerPaymentRequest(req.partner.id, id);
  }
}