import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jest } from '@jest/globals';
import { Role } from './interfaces/authenticated-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';

jest.unstable_mockModule('jose', async () => {
  const actual = await jest.requireActual<typeof import('jose')>('jose');
  return {
    ...actual,
    jwtVerify: jest.fn(),
  };
});

const { JwtAuthGuard } = await import('./jwt-auth.guard.js');
const { jwtVerify } = await import('jose');

describe('JwtAuthGuard', () => {
  let guard: InstanceType<typeof JwtAuthGuard>;
  let prisma: {
    customer: {
      findUnique: jest.Mock;
    };
  };

  const issuer = 'https://keycloak.test/realms/sbank';
  const audience = 'sbank-api';
  const clientId = 'sbank-app';

  const config = {
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

    prisma = {
      customer: {
        findUnique: jest.fn(),
      },
    };

    guard = new JwtAuthGuard(
      config as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );

    // jwtVerify is mocked, so no remote JWKS lookup is needed.
    (jwtVerify as jest.Mock).mockResolvedValue({
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
    (jwtVerify as jest.Mock).mockRejectedValue(new Error('Invalid token'));

    await expect(guard.canActivate(createContext().executionContext))
      .rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token issued to another client', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: mockPayload({ azp: 'other-client' }),
    });

    await expect(guard.canActivate(createContext().executionContext))
      .rejects.toThrow('expected client');
  });

  it('rejects a token without a subject', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: mockPayload({ sub: undefined }),
    });

    await expect(guard.canActivate(createContext().executionContext))
      .rejects.toThrow('no subject');
  });

  it('rejects tokens without an application role', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: mockPayload({ realm_access: { roles: [] } }),
    });

    await expect(guard.canActivate(createContext().executionContext))
      .rejects.toThrow('exactly one supported application role');
  });

  it('rejects tokens containing multiple application roles', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
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
      role: Role.CLIENT,
      ipAddress: '127.0.0.1',
    });
  });

   it('copies acr=2 from the validated token to the authenticated user', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: mockPayload({
        acr: '2',
        realm_access: { roles: [Role.EMPLOYEE] },
      }),
    });

    const ctx = createContext();
    await expect(guard.canActivate(ctx.executionContext)).resolves.toBe(true);

    expect(ctx.request.user.acr).toBe('2');
  });

  it('preserves acr=1 from the validated token', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: mockPayload({
        acr: '1',
        realm_access: { roles: [Role.EMPLOYEE] },
      }),
    });

    const ctx = createContext();
    await expect(guard.canActivate(ctx.executionContext)).resolves.toBe(true);

    expect(ctx.request.user.acr).toBe('1');
  });

  it('leaves acr undefined when the token does not contain the claim', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: mockPayload({
        realm_access: { roles: [Role.EMPLOYEE] },
      }),
    });

    const ctx = createContext();
    await expect(guard.canActivate(ctx.executionContext)).resolves.toBe(true);

    expect(ctx.request.user.acr).toBeUndefined();
  });

  it.each([Role.EMPLOYEE, Role.ADMIN])(
    'preserves the Keycloak subject for %s',
    async (role) => {
      (jwtVerify as jest.Mock).mockResolvedValue({
        payload: mockPayload({
          realm_access: { roles: [role] },
        }),
      });

      const ctx = createContext();
      await expect(guard.canActivate(ctx.executionContext)).resolves.toBe(true);

      expect(ctx.request.user).toEqual({
        id: 'keycloak-user-1',
        role,
        ipAddress: '127.0.0.1',
      });

      expect(prisma.customer.findUnique).not.toHaveBeenCalled();
    },
  );
});
