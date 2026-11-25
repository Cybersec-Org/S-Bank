import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PasskeysService } from './passkeys.service.js';
import { Role, type AuthenticatedUser } from './interfaces/authenticated-user.interface.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('PasskeysService', () => {
  let service: PasskeysService;
  let prisma: {
    customer: { findUnique: jest.Mock<(...args: any[]) => Promise<any>> };
    auditLog: { create: jest.Mock<(...args: any[]) => Promise<any>> };
  };
  const fetchMock = jest.fn<typeof fetch>();

  const config = {
    getOrThrow: jest.fn((key: string) => ({
      OIDC_ISSUER_URL: 'http://localhost:8080/realms/sbank',
      KEYCLOAK_ADMIN_USERNAME: 'admin',
      KEYCLOAK_ADMIN_PASSWORD: 'admin',
    })[key]),
    get: jest.fn(() => undefined),
  };

  const clientUser: AuthenticatedUser = {
    id: 'client-1',
    keycloakSub: 'kc-sub-1',
    role: Role.CLIENT,
    ipAddress: '127.0.0.1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = fetchMock;
    prisma = {
      customer: { findUnique: jest.fn() },
      auditLog: { create: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({}) },
    };
    service = new PasskeysService(
      config as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
  });

  it('lists only webauthn-passwordless credentials for the current user', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'admin-tok' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: 'pwd-1', type: 'password', createdDate: 1700000000000 },
            { id: 'pk-1', type: 'webauthn-passwordless', userLabel: 'Laptop', createdDate: 1700000100000 },
          ]),
          { status: 200 },
        ),
      );

    const res = await service.listPasskeys(clientUser);
    expect(res).toEqual([
      {
        id: 'pk-1',
        label: 'Laptop',
        createdAt: new Date(1700000100000).toISOString(),
      },
    ]);
  });

  it('deletes an owned passkey and writes an audit log entry', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'admin-tok' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: 'pk-1', type: 'webauthn-passwordless', userLabel: 'Telefon', createdDate: 1700000100000 }]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'admin-tok' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const res = await service.removePasskey('pk-1', clientUser);
    expect(res).toEqual({ deleted: true, id: 'pk-1' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'PASSKEY_REMOVED', resourceId: 'pk-1' }),
      }),
    );
  });

  it('rejects deleting an unknown passkey (BOLA protection)', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'admin-tok' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    await expect(service.removePasskey('other-pk', clientUser)).rejects.toThrow(NotFoundException);
  });

  it('prevents employee or admin from deleting their last passkey', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'admin-tok' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: 'pk-staff', type: 'webauthn-passwordless', userLabel: 'YubiKey' }]),
          { status: 200 },
        ),
      );

    await expect(
      service.removePasskey('pk-staff', { ...clientUser, role: Role.EMPLOYEE }),
    ).rejects.toThrow(ForbiddenException);
  });
});
