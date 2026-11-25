import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role, type AuthenticatedUser } from './interfaces/authenticated-user.interface.js';

export interface PasskeyDto {
  id: string;
  label: string;
  createdAt: string;
}

interface KeycloakCredential {
  id: string;
  type: string;
  userLabel?: string;
  createdDate?: number;
}

@Injectable()
export class PasskeysService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private getKeycloakAdminConfig() {
    const issuer = this.config.getOrThrow<string>('OIDC_ISSUER_URL').replace(/\/$/, '');
    const realmMarker = '/realms/';
    const idx = issuer.indexOf(realmMarker);
    if (idx === -1) {
      throw new InternalServerErrorException('Invalid OIDC_ISSUER_URL format for Keycloak admin');
    }
    const baseUrl = this.config.get<string>('KEYCLOAK_ADMIN_URL')?.replace(/\/$/, '') ?? issuer.slice(0, idx);
    const realm = issuer.slice(idx + realmMarker.length).split('/')[0];
    if (!realm) {
      throw new InternalServerErrorException('Realm missing in OIDC_ISSUER_URL');
    }
    const username = this.config.getOrThrow<string>('KEYCLOAK_ADMIN_USERNAME');
    const password = this.config.getOrThrow<string>('KEYCLOAK_ADMIN_PASSWORD');
    return { baseUrl, realm, username, password };
  }

  private async getAdminAccessToken(baseUrl: string, username: string, password: string): Promise<string> {
    const res = await fetch(`${baseUrl}/realms/master/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username,
        password,
      }),
    });

    if (!res.ok) {
      throw new InternalServerErrorException('Failed to authenticate with Keycloak Admin API');
    }

    const body = (await res.json()) as { access_token?: string };
    if (!body.access_token) {
      throw new InternalServerErrorException('Keycloak Admin API token missing');
    }
    return body.access_token;
  }

  private async resolveKeycloakSub(user: AuthenticatedUser): Promise<string> {
    if (user.keycloakSub) {
      return user.keycloakSub;
    }
    if (user.role === Role.CLIENT) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: user.id },
        select: { keycloakSub: true },
      });
      if (customer?.keycloakSub) {
        return customer.keycloakSub;
      }
    }
    return user.id;
  }

  async listPasskeys(user: AuthenticatedUser): Promise<PasskeyDto[]> {
    const { baseUrl, realm, username, password } = this.getKeycloakAdminConfig();
    const token = await this.getAdminAccessToken(baseUrl, username, password);
    const sub = await this.resolveKeycloakSub(user);

    const res = await fetch(
      `${baseUrl}/admin/realms/${encodeURIComponent(realm)}/users/${encodeURIComponent(sub)}/credentials`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) {
      throw new InternalServerErrorException('Failed to fetch user Passkeys from Keycloak');
    }

    const credentials = (await res.json()) as KeycloakCredential[];
    return credentials
      .filter((cred) => cred.type === 'webauthn-passwordless')
      .map((cred) => ({
        id: cred.id,
        label: cred.userLabel?.trim() || 'Klucz dostępu (Passkey)',
        createdAt: cred.createdDate
          ? new Date(cred.createdDate).toISOString()
          : new Date().toISOString(),
      }));
  }

  async removePasskey(credentialId: string, user: AuthenticatedUser): Promise<{ deleted: true; id: string }> {
    const passkeys = await this.listPasskeys(user);
    const target = passkeys.find((p) => p.id === credentialId);
    if (!target) {
      throw new NotFoundException({ code: 'PASSKEY_NOT_FOUND', message: 'Passkey not found' });
    }

    if ((user.role === Role.EMPLOYEE || user.role === Role.ADMIN) && passkeys.length <= 1) {
      throw new ForbiddenException({
        code: 'PASSKEY_REQUIRED',
        message: 'Employee and admin accounts must keep at least one Passkey registered.',
      });
    }

    const { baseUrl, realm, username, password } = this.getKeycloakAdminConfig();
    const token = await this.getAdminAccessToken(baseUrl, username, password);
    const sub = await this.resolveKeycloakSub(user);

    const res = await fetch(
      `${baseUrl}/admin/realms/${encodeURIComponent(realm)}/users/${encodeURIComponent(sub)}/credentials/${encodeURIComponent(credentialId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!res.ok) {
      throw new InternalServerErrorException('Failed to delete Passkey from Keycloak');
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        userRole: user.role,
        action: 'PASSKEY_REMOVED',
        resourceId: credentialId,
        ipAddress: user.ipAddress ?? '127.0.0.1',
        reason: `User removed Passkey (${target.label})`,
      },
    });

    return { deleted: true, id: credentialId };
  }
}
