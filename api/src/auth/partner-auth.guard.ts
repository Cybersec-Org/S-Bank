import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  type AuthenticatedPartner,
  PartnerId,
} from './interfaces/authenticated-partner.interface.js';

const PARTNERS: Record<string, AuthenticatedPartner> = {
  [PartnerId.PARTNER1]: {
    id: PartnerId.PARTNER1,
    permissions: ['payments:read'],
  },
  [PartnerId.PARTNER2]: {
    id: PartnerId.PARTNER2,
    permissions: ['reports:read'],
  },
};

@Injectable()
export class PartnerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const rawPartnerId = request.headers['x-partner-id'];

    if (typeof rawPartnerId !== 'string') {
      throw new UnauthorizedException('Missing partner identity');
    }

    const partner = PARTNERS[rawPartnerId.trim()];

    if (!partner) {
      throw new UnauthorizedException('Unknown partner');
    }

    request.partner = partner;

    return true;
  }
}
