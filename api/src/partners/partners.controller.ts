import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { PartnerAuthGuard } from '../auth/partner-auth.guard.js';
import { PartnerPermissionsGuard } from '../auth/partner-permissions.guard.js';
import { RequirePartnerPermissions } from '../auth/partner-permissions.decorator.js';

@Controller('api')
@UseGuards(PartnerAuthGuard, PartnerPermissionsGuard)
export class PartnersController {
  @Get('payments/test')
  @RequirePartnerPermissions('payments:read')
  getPayments() {
    return {
      message: 'Payments endpoint accessible',
      partner: 'partner1',
    };
  }

  @Get('reports/test')
  @RequirePartnerPermissions('reports:read')
  getReports() {
    return {
      message: 'Reports endpoint accessible',
      partner: 'partner2',
    };
  }
}
