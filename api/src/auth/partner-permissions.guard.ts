import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PARTNER_PERMISSIONS_KEY } from './partner-permissions.decorator.js';
import type {
  AuthenticatedPartner,
  PartnerPermission,
} from './interfaces/authenticated-partner.interface.js';

@Injectable()
export class PartnerPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.get<PartnerPermission[]>(
        PARTNER_PERMISSIONS_KEY,
        context.getHandler(),
      ) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const partner = request.partner as AuthenticatedPartner | undefined;

    if (!partner) {
      throw new ForbiddenException('Partner context is missing');
    }

    const hasPermissions = requiredPermissions.every(permission =>
      partner.permissions.includes(permission),
    );

    if (!hasPermissions) {
      throw new ForbiddenException(
        `Partner ${partner.id} does not have required permissions`,
      );
    }

    return true;
  }
}
