import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ExecutionContext } from '@nestjs/common';

import { PartnerPermissionsGuard } from './partner-permissions.guard.js';
import { PARTNER_PERMISSIONS_KEY } from './partner-permissions.decorator.js';
import {
  PartnerId,
  type AuthenticatedPartner,
  type PartnerPermission,
} from './interfaces/authenticated-partner.interface.js';

describe('PartnerPermissionsGuard', () => {
  let guard: PartnerPermissionsGuard;

  let reflector: {
    get: jest.Mock<
      (key: string, target: Function) => PartnerPermission[] | undefined
    >;
  };

  let request: {
    partner?: AuthenticatedPartner;
  };

  const handler = jest.fn();

  const context = {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = {
      get: jest.fn<
        (key: string, target: Function) => PartnerPermission[] | undefined
      >(),
    };

    request = {};

    guard = new PartnerPermissionsGuard(
      reflector as unknown as Reflector,
    );
  });

  it('allows access when no permissions are required', () => {
    reflector.get.mockReturnValue(undefined);

    expect(guard.canActivate(context)).toBe(true);
    expect(reflector.get).toHaveBeenCalledWith(
      PARTNER_PERMISSIONS_KEY,
      handler,
    );
  });

  it('allows access when the required permissions list is empty', () => {
    reflector.get.mockReturnValue([]);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects access when partner context is missing', () => {
    reflector.get.mockReturnValue(['payments:read']);

    expect(() => guard.canActivate(context)).toThrow(
      ForbiddenException,
    );
  });

  it('allows access when the partner has the required permission', () => {
    reflector.get.mockReturnValue(['payments:read']);

    request.partner = {
      id: PartnerId.PARTNER1,
      permissions: ['payments:read', 'payments:create'],
      expectedCertThumbprint: 'a'.repeat(64),
    };

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects access when the partner lacks the required permission', () => {
    reflector.get.mockReturnValue(['reports:read']);

    request.partner = {
      id: PartnerId.PARTNER1,
      permissions: ['payments:read', 'payments:create'],
      expectedCertThumbprint: 'a'.repeat(64),
    };

    expect(() => guard.canActivate(context)).toThrow(
      ForbiddenException,
    );
  });

  it('requires every permission when multiple permissions are specified', () => {
    reflector.get.mockReturnValue([
      'payments:read',
      'payments:create',
      'reports:read',
    ]);

    request.partner = {
      id: PartnerId.PARTNER1,
      permissions: ['payments:read', 'payments:create'],
      expectedCertThumbprint: 'a'.repeat(64),
    };

    expect(() => guard.canActivate(context)).toThrow(
      ForbiddenException,
    );
  });

  it('allows access when the partner has all required permissions', () => {
    reflector.get.mockReturnValue([
      'payments:read',
      'payments:create',
    ]);

    request.partner = {
      id: PartnerId.PARTNER2,
      permissions: [
        'reports:read',
        'payments:read',
        'payments:create',
      ],
      expectedCertThumbprint: 'b'.repeat(64),
    };

    expect(guard.canActivate(context)).toBe(true);
  });
});
