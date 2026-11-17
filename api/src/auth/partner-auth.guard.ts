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
    permissions: ['payments:read', 'payments:create'],
    expectedCertThumbprint: process.env['PARTNER1_CERT_SHA256'] ?? 'partner1-cert-sha256',
  },
  [PartnerId.PARTNER2]: {
    id: PartnerId.PARTNER2,
    permissions: ['reports:read', 'payments:read', 'payments:create'],
    expectedCertThumbprint: process.env['PARTNER2_CERT_SHA256'] ?? 'partner2-cert-sha256',
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

    const certThumbprint = request.headers['x-client-cert-sha256'];
    if (
      typeof certThumbprint === 'string' &&
      partner.expectedCertThumbprint &&
      certThumbprint.trim() !== partner.expectedCertThumbprint
    ) {
      throw new UnauthorizedException(
        'Certificate thumbprint mismatch (RFC 8705 mTLS binding failed)',
      );
    }

    request.partner = partner;

    return true;
  }
}