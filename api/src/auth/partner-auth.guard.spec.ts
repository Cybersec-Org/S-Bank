import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ExecutionContext } from '@nestjs/common';
import { PartnerAuthGuard } from './partner-auth.guard.js';
import { PartnerId } from './interfaces/authenticated-partner.interface.js';

describe('PartnerAuthGuard', () => {
  let guard: PartnerAuthGuard;

  let config: {
    get: jest.Mock<(key: string) => string | undefined>;
  };

  let request: {
    headers: Record<string, unknown>;
    partner?: unknown;
  };

  const proxyToken = 'test-proxy-secret';
  const partner1Fingerprint = 'a'.repeat(64);
  const partner2Fingerprint = 'b'.repeat(64);

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;

  beforeEach(() => {
    config = {
      get: jest.fn<(key: string) => string | undefined>((key) => {
        const values: Record<string, string> = {
          PARTNER_PROXY_TOKEN: proxyToken,
          PARTNER1_CERT_SHA256: partner1Fingerprint,
          PARTNER2_CERT_SHA256: partner2Fingerprint,
        };

        return values[key];
      }),
    };

    request = {
      headers: {
        'x-sbank-proxy-token': proxyToken,
        'x-partner-id': PartnerId.PARTNER1,
        'x-client-cert-sha256': partner1Fingerprint,
      },
    };

    guard = new PartnerAuthGuard(config as unknown as ConfigService);
  });

  it('authenticates Partner1 and attaches its permissions', () => {
    expect(guard.canActivate(context)).toBe(true);

    expect(request.partner).toEqual({
      id: PartnerId.PARTNER1,
      permissions: ['payments:read', 'payments:create'],
      expectedCertThumbprint: partner1Fingerprint,
    });
  });

  it('authenticates Partner2 with its own permissions', () => {
    request.headers['x-partner-id'] = PartnerId.PARTNER2;
    request.headers['x-client-cert-sha256'] = partner2Fingerprint;

    expect(guard.canActivate(context)).toBe(true);

    expect(request.partner).toEqual({
      id: PartnerId.PARTNER2,
      permissions: ['reports:read', 'payments:read', 'payments:create'],
      expectedCertThumbprint: partner2Fingerprint,
    });
  });

  it('accepts fingerprints with colons and uppercase characters', () => {
    request.headers['x-client-cert-sha256'] =
      partner1Fingerprint.toUpperCase().match(/.{2}/g)!.join(':');

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects missing proxy token configuration', () => {
    config.get.mockImplementation((key) =>
      key === 'PARTNER_PROXY_TOKEN' ? undefined : (
        key === 'PARTNER1_CERT_SHA256' ? partner1Fingerprint : partner2Fingerprint
      ),
    );

    expect(() => guard.canActivate(context)).toThrow(
      InternalServerErrorException,
    );
  });

  it.each([undefined, '', 'wrong-token', ['test-proxy-secret']])(
    'rejects invalid proxy token: %s',
    (token) => {
      request.headers['x-sbank-proxy-token'] = token;

      expect(() => guard.canActivate(context)).toThrow(
        UnauthorizedException,
      );
    },
  );

  it('rejects missing partner identity', () => {
    delete request.headers['x-partner-id'];

    expect(() => guard.canActivate(context)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects non-string partner identity', () => {
    request.headers['x-partner-id'] = ['PARTNER1'];

    expect(() => guard.canActivate(context)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects unknown partner identity', () => {
    request.headers['x-partner-id'] = 'PARTNER3';

    expect(() => guard.canActivate(context)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects missing certificate fingerprint configuration', () => {
    config.get.mockImplementation((key) => {
      if (key === 'PARTNER_PROXY_TOKEN') return proxyToken;
      if (key === 'PARTNER1_CERT_SHA256') return '';
      return partner2Fingerprint;
    });

    expect(() => guard.canActivate(context)).toThrow(
      InternalServerErrorException,
    );
  });

  it.each([undefined, '', 'wrong-fingerprint', ['a'.repeat(64)]])(
    'rejects invalid client certificate fingerprint: %s',
    (fingerprint) => {
      request.headers['x-client-cert-sha256'] = fingerprint;

      expect(() => guard.canActivate(context)).toThrow(
        UnauthorizedException,
      );
    },
  );

  it('rejects Partner2 certificate presented as Partner1', () => {
    request.headers['x-client-cert-sha256'] = partner2Fingerprint;

    expect(() => guard.canActivate(context)).toThrow(
      UnauthorizedException,
    );
  });

  it('does not attach a partner when authentication fails', () => {
    request.headers['x-sbank-proxy-token'] = 'invalid';

    expect(() => guard.canActivate(context)).toThrow(
      UnauthorizedException,
    );

    expect(request.partner).toBeUndefined();
  });
});
