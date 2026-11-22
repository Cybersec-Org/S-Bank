import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ExecutionContext } from '@nestjs/common';
import { UserAuthGuard } from './user-auth.guard.js';
import { MockAuthGuard } from './mock-auth.guard.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('UserAuthGuard', () => {
  let guard: UserAuthGuard;

  let config: {
    get: jest.Mock<(key: string) => string | undefined>;
  };

  let mockAuthGuard: {
    canActivate: jest.Mock<(context: ExecutionContext) => boolean | Promise<boolean>>;
  };

  let jwtAuthGuard: {
    canActivate: jest.Mock<(context: ExecutionContext) => boolean | Promise<boolean>>;
  };

  const context = {} as ExecutionContext;

  beforeEach(() => {
    config = {
      get: jest.fn<(key: string) => string | undefined>(),
    };

    mockAuthGuard = {
      canActivate: jest.fn<(context: ExecutionContext) => boolean | Promise<boolean>>(),
    };

    jwtAuthGuard = {
      canActivate: jest.fn<(context: ExecutionContext) => boolean | Promise<boolean>>(),
    };

    guard = new UserAuthGuard(
      config as unknown as ConfigService,
      mockAuthGuard as unknown as MockAuthGuard,
      jwtAuthGuard as unknown as JwtAuthGuard,
    );
  });

  it('delegates to MockAuthGuard when AUTH_MODE is mock outside production', async () => {
    config.get.mockImplementation((key) => {
      if (key === 'AUTH_MODE') return 'mock';
      if (key === 'NODE_ENV') return 'development';
      return undefined;
    });
    mockAuthGuard.canActivate.mockResolvedValue(true);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(mockAuthGuard.canActivate).toHaveBeenCalledWith(context);
    expect(jwtAuthGuard.canActivate).not.toHaveBeenCalled();
  });

  it('returns false when MockAuthGuard rejects activation', async () => {
    config.get.mockImplementation((key) => {
      if (key === 'AUTH_MODE') return 'mock';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    });
    mockAuthGuard.canActivate.mockResolvedValue(false);

    await expect(guard.canActivate(context)).resolves.toBe(false);

    expect(mockAuthGuard.canActivate).toHaveBeenCalledWith(context);
    expect(jwtAuthGuard.canActivate).not.toHaveBeenCalled();
  });

  it('rejects mock authentication in production', async () => {
    config.get.mockImplementation((key) => {
      if (key === 'AUTH_MODE') return 'mock';
      if (key === 'NODE_ENV') return 'production';
      return undefined;
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      InternalServerErrorException,
    );

    expect(mockAuthGuard.canActivate).not.toHaveBeenCalled();
    expect(jwtAuthGuard.canActivate).not.toHaveBeenCalled();
  });

  it('delegates to JwtAuthGuard when AUTH_MODE is oidc', async () => {
    config.get.mockImplementation((key) => {
      if (key === 'AUTH_MODE') return 'oidc';
      if (key === 'NODE_ENV') return 'production';
      return undefined;
    });
    jwtAuthGuard.canActivate.mockResolvedValue(true);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(jwtAuthGuard.canActivate).toHaveBeenCalledWith(context);
    expect(mockAuthGuard.canActivate).not.toHaveBeenCalled();
  });

  it('returns false when JwtAuthGuard rejects activation', async () => {
    config.get.mockImplementation((key) => {
      if (key === 'AUTH_MODE') return 'oidc';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    });
    jwtAuthGuard.canActivate.mockResolvedValue(false);

    await expect(guard.canActivate(context)).resolves.toBe(false);

    expect(jwtAuthGuard.canActivate).toHaveBeenCalledWith(context);
    expect(mockAuthGuard.canActivate).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'invalid', 'OIDC', 'MOCK'])(
    'rejects unsupported AUTH_MODE: %s',
    async (mode) => {
      config.get.mockImplementation((key) => {
        if (key === 'AUTH_MODE') return mode;
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockAuthGuard.canActivate).not.toHaveBeenCalled();
      expect(jwtAuthGuard.canActivate).not.toHaveBeenCalled();
    },
  );
});
