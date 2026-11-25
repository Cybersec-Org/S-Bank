import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jest } from '@jest/globals';
import { Role } from './interfaces/authenticated-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';

type AnyMock = jest.Mock<(...args: any[]) => any>;

jest.unstable_mockModule('jose', async () => {
  const actual = await jest.requireActual<typeof import('jose')>('jose');
  return {
    ...actual,
    jwtVerify: jest.fn(),
    createRemoteJWKSet: jest.fn(() => 'jwks'),
  };
});

const { JwtAuthGuard } = await import('./jwt-auth.guard.js');
const jose = await import('jose');
const jwtVerify = jose.jwtVerify as unknown as AnyMock;
const createRemoteJWKSet = jose.createRemoteJWKSet as unknown as AnyMock;

describe('JwtAuthGuard', () => {
  let guard: InstanceType<typeof JwtAuthGuard>;
  let prisma: {
    customer: {
      findUnique: AnyMock;
      updateMany: AnyMock;
      create: AnyMock;
    };
  };
  let optionalConfig: Record<string, string | undefined>;

  const issuer = 'https://keycloak.test/realms/sbank';
  const audience = 'sbank-api';
  const clientId = 'sbank-app';

  const config = {
    get: jest.fn((key: string) => optionalConfig[key]),
    getOrThrow: jest.fn((key: string) => ({
      OIDC_ISSUER_URL: issuer,
      OIDC_AUDIENCE: audience,
      OIDC_CLIENT_ID: clientId,
    })[key]),
  };

  const mockPayload = (overrides: Record<string, unknown> = {}) => ({
    sub: 'keycloak-user-1',
    azp: clientId,
    iss: issuer,
    aud: audience,
    realm_access: { roles: [Role.CLIENT] },
    ...overrides,
  });

  const createContext = (authorization = 'Bearer valid-token') => {
    const request: any = {
      headers: { authorization },
      ip: '127.0.0.1',
    };

    return {
      request,
      executionContext: {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as any,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    optionalConfig = {};
    prisma = {
      customer: {
        findUnique: jest.fn<(...args: any[]) => any>(),
        updateMany: jest.fn<(...args: any[]) => any>(),
        create: jest.fn<(...args: any[]) => any>(),
      },
    };

    guard = new JwtAuthGuard(
      config as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );

    // jwtVerify is mocked, so no remote JWKS lookup is needed.
    jwtVerify.mockResolvedValue({
      payload: mockPayload(),
    });
  });

  it('rejects requests without a Bearer token', async () => {
    const ctx = createContext('');
    ctx.request.headers = {};

    await expect(guard.canActivate(ctx.executionContext))
      .rejects.toThrow(UnauthorizedException);
  });

  it('rejects an empty Bearer token', async () => {
    const ctx = createContext('Bearer ');

    await expect(guard.canActivate(ctx.executionContext))
      .rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid token', async () => {
    jwtVerify.mockRejectedValue(new Error('Invalid token'));

    await expect(guard.canActivate(createContext().executionContext))
      .rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token issued to another client', async () => {
    jwtVerify.mockResolvedValue({
      payload: mockPayload({ azp: 'other-client' }),
    });

    await expect(guard.canActivate(createContext().executionContext))
      .rejects.toThrow('expected client');
  });

  it('rejects a token without a subject', async () => {
    jwtVerify.mockResolvedValue({
      payload: mockPayload({ sub: undefined }),
    });

    await expect(guard.canActivate(createContext().executionContext))
      .rejects.toThrow('no subject');
  });

  it('rejects tokens without an application role', async () => {
    jwtVerify.mockResolvedValue({
      payload: mockPayload({ realm_access: { roles: [] } }),
    });

    await expect(guard.canActivate(createContext().executionContext))
      .rejects.toThrow('exactly one supported application role');
  });

  it('rejects tokens containing multiple application roles', async () => {
    jwtVerify.mockResolvedValue({
      payload: mockPayload({
        realm_access: { roles: [Role.CLIENT, Role.ADMIN] },
      }),
    });

    await expect(guard.canActivate(createContext().executionContext))
      .rejects.toThrow('exactly one supported application role');
  });

  it('rejects a CLIENT without a linked customer', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(createContext().executionContext))
      .rejects.toThrow('not linked to a customer account');
  });

  it('maps a CLIENT subject to the internal customer ID', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'customer-123' });

    const ctx = createContext();
    await expect(guard.canActivate(ctx.executionContext)).resolves.toBe(true);

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: { keycloakSub: 'keycloak-user-1' },
      select: { id: true },
    });

    expect(ctx.request.user).toEqual({
      id: 'customer-123',
      keycloakSub: 'keycloak-user-1',
      role: Role.CLIENT,
      ipAddress: '127.0.0.1',
    });
  });

   it('copies acr=2 and auth_time from the validated token to the authenticated user', async () => {
    jwtVerify.mockResolvedValue({
      payload: mockPayload({
        acr: '2',
        auth_time: 1700000000,
        realm_access: { roles: [Role.EMPLOYEE] },
      }),
    });

    const ctx = createContext();
    await expect(guard.canActivate(ctx.executionContext)).resolves.toBe(true);

    expect(ctx.request.user.acr).toBe('2');
    expect(ctx.request.user.authTime).toBe(1700000000);
  });

  it('preserves acr=1 from the validated token for CLIENT', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'customer-123' });
    jwtVerify.mockResolvedValue({
      payload: mockPayload({
        acr: '1',
        realm_access: { roles: ['customer'] },
      }),
    });

    const ctx = createContext();
    await expect(guard.canActivate(ctx.executionContext)).resolves.toBe(true);

    expect(ctx.request.user.role).toBe(Role.CLIENT);
    expect(ctx.request.user.acr).toBe('1');
  });

  it('leaves acr undefined when the token does not contain the claim for CLIENT', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'customer-123' });
    jwtVerify.mockResolvedValue({
      payload: mockPayload({
        realm_access: { roles: [Role.CLIENT] },
      }),
    });

    const ctx = createContext();
    await expect(guard.canActivate(ctx.executionContext)).resolves.toBe(true);

    expect(ctx.request.user.acr).toBeUndefined();
  });

  it.each([Role.EMPLOYEE, Role.ADMIN, 'employee', 'admin'])(
    'rejects %s when acr is not 2 (Passkey required)',
    async (role) => {
      jwtVerify.mockResolvedValue({
        payload: mockPayload({
          acr: '1',
          realm_access: { roles: [role] },
        }),
      });

      await expect(guard.canActivate(createContext().executionContext))
        .rejects.toThrow(ForbiddenException);
    },
  );

  it.each([Role.EMPLOYEE, Role.ADMIN])(
    'preserves the Keycloak subject for %s when acr=2',
    async (role) => {
      jwtVerify.mockResolvedValue({
        payload: mockPayload({
          acr: '2',
          realm_access: { roles: [role] },
        }),
      });

      const ctx = createContext();
      await expect(guard.canActivate(ctx.executionContext)).resolves.toBe(true);

      expect(ctx.request.user).toEqual({
        id: 'keycloak-user-1',
        keycloakSub: 'keycloak-user-1',
        role,
        acr: '2',
        ipAddress: '127.0.0.1',
      });

      expect(prisma.customer.findUnique).not.toHaveBeenCalled();
    },
  );

  describe('first sign-in of an unlinked CLIENT (B-09, A1)', () => {
    const existing = { id: 'client-2', keycloakSub: null as string | null };

    it.each([
      ['no e-mail', {}],
      ['an unverified e-mail', { email: 'anna.nowak@example.com', email_verified: false }],
      ['an e-mail without the email_verified claim', { email: 'anna.nowak@example.com' }],
    ])('refuses a token with %s and writes nothing', async (_label, claims) => {
      prisma.customer.findUnique.mockResolvedValue(null);
      jwtVerify.mockResolvedValue({ payload: mockPayload(claims) });

      await expect(guard.canActivate(createContext().executionContext))
        .rejects.toThrow('not linked to a customer account');

      expect(prisma.customer.updateMany).not.toHaveBeenCalled();
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('never hands over a customer already linked to another Keycloak subject', async () => {
      prisma.customer.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...existing, keycloakSub: 'someone-else' });
      jwtVerify.mockResolvedValue({
        payload: mockPayload({ email: 'Anna.Nowak@example.com', email_verified: true }),
      });

      await expect(guard.canActivate(createContext().executionContext))
        .rejects.toThrow('not linked to a customer account');

      expect(prisma.customer.updateMany).not.toHaveBeenCalled();
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('links an unlinked customer when the verified e-mail matches', async () => {
      prisma.customer.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);
      prisma.customer.updateMany.mockResolvedValue({ count: 1 });
      jwtVerify.mockResolvedValue({
        payload: mockPayload({ email: 'Anna.Nowak@example.com', email_verified: true }),
      });

      const ctx = createContext();
      await expect(guard.canActivate(ctx.executionContext)).resolves.toBe(true);

      expect(prisma.customer.findUnique).toHaveBeenLastCalledWith({
        where: { email: 'anna.nowak@example.com' },
        select: { id: true, keycloakSub: true },
      });
      expect(prisma.customer.updateMany).toHaveBeenCalledWith({
        where: { id: 'client-2', keycloakSub: null },
        data: { keycloakSub: 'keycloak-user-1' },
      });
      expect(ctx.request.user.id).toBe('client-2');
    });

    it('refuses when a concurrent sign-in linked the customer first', async () => {
      prisma.customer.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);
      prisma.customer.updateMany.mockResolvedValue({ count: 0 });
      jwtVerify.mockResolvedValue({
        payload: mockPayload({ email: 'anna.nowak@example.com', email_verified: true }),
      });

      await expect(guard.canActivate(createContext().executionContext))
        .rejects.toThrow('not linked to a customer account');
    });

    it('creates a new customer for a verified e-mail that is not in the bank yet', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({ id: 'keycloak-user-1' });
      jwtVerify.mockResolvedValue({
        payload: mockPayload({ email: 'nowy@example.com', email_verified: true }),
      });

      const ctx = createContext();
      await expect(guard.canActivate(ctx.executionContext)).resolves.toBe(true);

      const createArgs = prisma.customer.create.mock.calls[0]?.[0] as {
        data: { id: string; keycloakSub: string; email: string };
      };
      expect(createArgs.data).toMatchObject({
        id: 'keycloak-user-1',
        keycloakSub: 'keycloak-user-1',
        email: 'nowy@example.com',
      });
      expect(ctx.request.user.id).toBe('keycloak-user-1');
    });
  });

  describe('JWKS location (A12)', () => {
    it('uses the issuer certs endpoint by default', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'customer-123' });

      await guard.canActivate(createContext().executionContext);

      expect(createRemoteJWKSet).toHaveBeenCalledWith(
        new URL(`${issuer}/protocol/openid-connect/certs`),
      );
    });

    it('uses OIDC_JWKS_URL when set and still checks the public issuer', async () => {
      optionalConfig = { OIDC_JWKS_URL: 'http://keycloak:8080/realms/sbank/protocol/openid-connect/certs' };
      prisma.customer.findUnique.mockResolvedValue({ id: 'customer-123' });

      await guard.canActivate(createContext().executionContext);

      expect(createRemoteJWKSet).toHaveBeenCalledWith(
        new URL('http://keycloak:8080/realms/sbank/protocol/openid-connect/certs'),
      );
      expect(jwtVerify).toHaveBeenCalledWith(
        'valid-token',
        'jwks',
        expect.objectContaining({ issuer, audience, algorithms: ['RS256'] }),
      );
    });
  });
});
