import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyOptions } from 'jose';
import { IS_PUBLIC_KEY } from './policies.guard.js';
import { type AuthenticatedUser, Role } from './interfaces/authenticated-user.interface.js';

@Injectable()
export class MockAuthGuard implements CanActivate {
  private readonly jwks = process.env['KEYCLOAK_JWKS_URI']
    ? createRemoteJWKSet(new URL(process.env['KEYCLOAK_JWKS_URI']))
    : null;

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (!this.jwks) {
        throw new UnauthorizedException('JWT verification (JWKS) is not configured');
      }

      try {
        // A8: same algorithm allow-list as the OIDC guard, so `alg` cannot be chosen by the token.
        const verifyOptions: JWTVerifyOptions = { algorithms: ['RS256'] };
        const issuer = process.env['KEYCLOAK_ISSUER'];
        const audience = process.env['KEYCLOAK_AUDIENCE'];

        if (issuer) verifyOptions.issuer = issuer;
        if (audience) verifyOptions.audience = audience;

        const { payload } = await jwtVerify(token, this.jwks, verifyOptions);

        const realmAccess = payload['realm_access'] as { roles?: string[] } | undefined;
        const realmRoles: string[] = (realmAccess?.roles ?? []).map((r: string) =>
          r.toUpperCase(),
        );

        let role = Role.CLIENT;
        if (realmRoles.includes('ADMIN')) role = Role.ADMIN;
        else if (realmRoles.includes('EMPLOYEE') || realmRoles.includes('SUPPORT')) {
          role = Role.EMPLOYEE;
        }

        const rawPayloadAcr = payload['acr'];

        request.user = {
          id: String(payload.sub),
          role,
          ipAddress: request.ip || '127.0.0.1',
          acr: rawPayloadAcr ? String(rawPayloadAcr) : '1',
        } satisfies AuthenticatedUser;

        return true;
      } catch {
        throw new UnauthorizedException('Invalid or expired Bearer token');
      }
    }

    const rawUserId = request.headers['x-user-id'] as string | undefined;
    const rawRole = request.headers['x-user-role'] as string | undefined;
    const rawAcr = request.headers['x-user-acr'] as string | undefined;
    const rawStepUp = request.headers['x-step-up'] as string | undefined;

    const isStrict =
      process.env['NODE_ENV'] === 'production' || process.env['STRICT_AUTH'] === 'true';
    if (isStrict && (!rawUserId || !rawRole)) {
      throw new UnauthorizedException('Authentication required (deny by default)');
    }

    const userId = rawUserId?.trim() || 'client-1';
    const roleUpper = rawRole?.trim().toUpperCase() || Role.CLIENT;

    if (!Object.values(Role).includes(roleUpper as Role)) {
      throw new UnauthorizedException(
        `Invalid user role "${rawRole}". Allowed roles: ${Object.values(Role).join(', ')}`,
      );
    }

    const acrValue =
      rawStepUp?.trim().toLowerCase() === 'true' ? '2' : rawAcr?.trim() || '1';

    request.user = {
      id: userId,
      role: roleUpper as Role,
      ipAddress: request.ip || '127.0.0.1',
      acr: acrValue,
    } satisfies AuthenticatedUser;

    return true;
  }
}