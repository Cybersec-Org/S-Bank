import { randomInt } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  Logger,
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
  acr?: string;
  auth_time?: number;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  realm_access?: {
    roles?: string[];
  };
}

const ROLE_ALIASES: Readonly<Record<string, Role>> = {
  CLIENT: Role.CLIENT,
  customer: Role.CLIENT,
  EMPLOYEE: Role.EMPLOYEE,
  employee: Role.EMPLOYEE,
  ADMIN: Role.ADMIN,
  admin: Role.ADMIN,
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
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

  /**
   * Keys come from `OIDC_JWKS_URL` when set (an API container reaches Keycloak by its service name while the
   * tokens keep the public issuer), otherwise from the issuer's standard certs endpoint. `iss` is always
   * checked against `OIDC_ISSUER_URL`.
   */
  private getJwks(issuer: string) {
    if (!this.jwks) {
      const jwksUrl =
        this.config.get<string>('OIDC_JWKS_URL')?.trim() ||
        `${issuer}/protocol/openid-connect/certs`;
      this.jwks = createRemoteJWKSet(new URL(jwksUrl));
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

    const mappedRoles = Array.from(
      new Set(
        (payload.realm_access?.roles ?? [])
          .map((rawRole) => ROLE_ALIASES[rawRole])
          .filter((mapped): mapped is Role => mapped !== undefined),
      ),
    );

    const role = mappedRoles[0];

    if (mappedRoles.length !== 1 || !role) {
      throw new UnauthorizedException(
        'Token must contain exactly one supported application role',
      );
    }

    if ((role === Role.EMPLOYEE || role === Role.ADMIN) && payload.acr !== '2') {
      throw new ForbiddenException({
        code: 'PASSKEY_REQUIRED',
        message: 'Employee and admin accounts require Passkey authentication (acr=2).',
      });
    }

    let userId = payload.sub;

    if (role === Role.CLIENT) {
      let customer = await this.prisma.customer.findUnique({
        where: { keycloakSub: payload.sub },
        select: { id: true },
      });

      if (!customer) {
        customer = await this.provisionOrLinkCustomer(payload);
      }

      if (!customer) {
        throw new UnauthorizedException('Keycloak user is not linked to a customer account');
      }

      userId = customer.id;
    }

    const user: AuthenticatedUser = {
      id: userId,
      keycloakSub: payload.sub,
      role,
      ipAddress: request.ip || '127.0.0.1',
      acr: payload.acr,
      ...(typeof payload.auth_time === 'number' ? { authTime: payload.auth_time } : {}),
      ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
      ...(typeof payload.given_name === 'string' ? { firstName: payload.given_name } : {}),
      ...(typeof payload.family_name === 'string' ? { lastName: payload.family_name } : {}),
    };

    request.user = user;
    return true;
  }

  /**
   * B-09: first sign-in of a customer that has no `keycloakSub` link yet. Only a **verified** e-mail counts as
   * proof of identity (A1): an unverified or missing e-mail never links or creates anything, and a customer
   * already linked to a different Keycloak user is never handed over. Returns `null` when the caller must be
   * refused (401).
   */
  private async provisionOrLinkCustomer(payload: KeycloakPayload): Promise<{ id: string } | null> {
    const sub = payload.sub;
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (!sub || email === '' || payload.email_verified !== true) {
      return null;
    }

    const existingByEmail = await this.prisma.customer.findUnique({
      where: { email },
      select: { id: true, keycloakSub: true },
    });

    if (existingByEmail) {
      if (existingByEmail.keycloakSub !== null) {
        this.logger.warn('Refused to link a Keycloak user to a customer already linked to another subject');
        return null;
      }
      // Conditional update: two first sign-ins racing for the same customer cannot both win.
      const linked = await this.prisma.customer.updateMany({
        where: { id: existingByEmail.id, keycloakSub: null },
        data: { keycloakSub: sub },
      });
      return linked.count === 1 ? { id: existingByEmail.id } : null;
    }

    const randomDigits = `${randomInt(10000000, 99999999)}${randomInt(10000000, 99999999)}${randomInt(10000000, 99999999)}`;
    const demoIban = `PL${randomInt(10, 99)}${randomDigits}`;

    try {
      return await this.prisma.customer.create({
        data: {
          id: sub,
          keycloakSub: sub,
          firstName: payload.given_name?.trim() || 'Nowy',
          lastName: payload.family_name?.trim() || 'Klient',
          email,
          customerNumber: `CUST-${randomInt(10000, 99999)}`,
          accounts: {
            create: {
              iban: demoIban,
              currency: 'PLN',
              balance: 5000.0,
              dailyLimit: 10000.0,
              status: 'ACTIVE',
            },
          },
        },
        select: { id: true },
      });
    } catch {
      // A concurrent first request created the link (unique keycloakSub/email/id): use it if it is ours.
      return this.prisma.customer.findUnique({
        where: { keycloakSub: sub },
        select: { id: true },
      });
    }
  }
}
