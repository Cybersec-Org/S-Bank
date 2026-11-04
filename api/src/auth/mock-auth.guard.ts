import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { type AuthenticatedUser, Role } from './interfaces/authenticated-user.interface.js';

@Injectable()
export class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const rawUserId = request.headers['x-user-id'] as string | undefined;
    const rawRole = request.headers['x-user-role'] as string | undefined;

    const userId = rawUserId?.trim() || 'client-1';
    const roleUpper = rawRole?.trim().toUpperCase() || Role.CLIENT;

    if (!Object.values(Role).includes(roleUpper as Role)) {
      throw new UnauthorizedException(
        `Invalid user role "${rawRole}". Allowed roles: ${Object.values(Role).join(', ')}`,
      );
    }

    const user: AuthenticatedUser = {
      id: userId,
      role: roleUpper as Role,
      ipAddress: request.ip || '127.0.0.1',
    };

    request.user = user;
    return true;
  }
}