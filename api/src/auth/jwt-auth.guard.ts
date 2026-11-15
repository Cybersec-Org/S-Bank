
import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role, type AuthenticatedUser } from './interfaces/authenticated-user.interface.js';

interface KeycloakPayload extends JWTPayload {
  azp?: string;
  typ?: string;
  realm_access?: {
    roles?: string[];
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private getOidcConfig() {
    const issuer = this.config.getOrThrow<string>('OIDC_ISSUER_URL').replace(/\/$/, '');

    return {
      issuer,
      audience: this.config.getOrThrow<string>('OIDC_AUDIENCE'),
      clientId: this.config.getOrThrow<string>('OIDC_CLIENT_ID'),
    };
  }

  private getJwks(issuer: string) {
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(
        new URL(`${issuer}/protocol/openid-connect/certs`),
      );
    }

    return this.jwks;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer access token');
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing Bearer access token');
    }

    const { issuer, audience, clientId } = this.getOidcConfig();

    let payload: KeycloakPayload;

    try {
      const result = await jwtVerify(token, this.getJwks(issuer), {
        issuer,
        audience,
        algorithms: ['RS256'],
      });

      payload = result.payload as KeycloakPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (payload.azp !== clientId) {
      throw new UnauthorizedException('Token was not issued to the expected client');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Token has no subject');
    }

    const allowedRoles = Object.values(Role);
    const roles = (payload.realm_access?.roles ?? [])
      .filter((role): role is Role => allowedRoles.includes(role as Role));

    const role = roles[0];

    if (roles.length !== 1 || !role) {
      throw new UnauthorizedException(
        'Token must contain exactly one supported application role',
      );
    } 
    let userId = payload.sub;

    if (role === Role.CLIENT) {
      const customer = await this.prisma.customer.findUnique({
        where: { keycloakSub: payload.sub },
        select: { id: true },
      });

      if (!customer) {
        throw new UnauthorizedException('Keycloak user is not linked to a customer account');
      }

      userId = customer.id;
    }

    const user: AuthenticatedUser = {
      id: userId,
      role,
      ipAddress: request.ip || '127.0.0.1',
    };

    request.user = user;
    return true;
  }
}

