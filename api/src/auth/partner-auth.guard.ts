
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

import {
  type AuthenticatedPartner,
  PartnerId,
} from './interfaces/authenticated-partner.interface.js';

function normalizeFingerprint(value: string): string {
  return value.replaceAll(':', '').toLowerCase().trim();
}

function secureCompare(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

@Injectable()
export class PartnerAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const proxyToken = this.config.get<string>('PARTNER_PROXY_TOKEN');

    if (!proxyToken) {
      throw new InternalServerErrorException(
        'Partner proxy authentication is not configured',
      );
    }

    const request = context.switchToHttp().getRequest();

    const suppliedToken = request.headers['x-sbank-proxy-token'];

    if (
      typeof suppliedToken !== 'string' ||
      !secureCompare(suppliedToken, proxyToken)
    ) {
      throw new UnauthorizedException('Invalid proxy authentication');
    }

    const rawPartnerId = request.headers['x-partner-id'];

    if (typeof rawPartnerId !== 'string') {
      throw new UnauthorizedException('Missing partner identity');
    }

    const partnerId = rawPartnerId.trim();

    const partnerConfig: Record<
      string,
      { fingerprint: string; permissions: AuthenticatedPartner['permissions'] }
    > = {
      [PartnerId.PARTNER1]: {
        fingerprint: this.config.get<string>('PARTNER1_CERT_SHA256') ?? '',
        permissions: ['payments:read', 'payments:create'],
      },
      [PartnerId.PARTNER2]: {
        fingerprint: this.config.get<string>('PARTNER2_CERT_SHA256') ?? '',
        permissions: ['reports:read', 'payments:read', 'payments:create'],
      },
    };

    const selectedPartner = partnerConfig[partnerId];

    if (!selectedPartner) {
      throw new UnauthorizedException('Unknown partner');
    }

    if (!selectedPartner.fingerprint) {
      throw new InternalServerErrorException(
        `Certificate fingerprint for ${partnerId} is not configured`,
      );
    }

    const suppliedFingerprint =
      request.headers['x-client-cert-sha256'];

    if (
      typeof suppliedFingerprint !== 'string' ||
      !secureCompare(
        normalizeFingerprint(suppliedFingerprint),
        normalizeFingerprint(selectedPartner.fingerprint),
      )
    ) {
      throw new UnauthorizedException('Client certificate mismatch');
    }

    const partner: AuthenticatedPartner = {
      id: partnerId as PartnerId,
      permissions: selectedPartner.permissions,
      expectedCertThumbprint: normalizeFingerprint(
        selectedPartner.fingerprint,
      ),
    };

    request.partner = partner;

    return true;
  }
}

