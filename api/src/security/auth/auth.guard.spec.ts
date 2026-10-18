import {
  type ExecutionContext,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPrincipal, fixedClock, FIXED_NOW_SECONDS } from '../../../test/helpers/factories.js';
import { AuthGuard } from './auth.guard.js';
import type { Principal } from './principal.js';
import { Public } from './public.decorator.js';
import { Roles } from './roles.decorator.js';
import { RequireStepUp } from './step-up.decorator.js';
import { StepUpRequiredException } from './step-up-required.exception.js';
import type { TokenVerifier } from './token-verifier.js';

class SampleController {
  @Public()
  publicRoute(): void {}

  @Roles('customer')
  customerRoute(): void {}

  @Roles('customer', 'employee')
  sharedRoute(): void {}

  @Roles('admin')
  @RequireStepUp({ maxAgeSeconds: 300 })
  adminStepUpRoute(): void {}

  undeclaredRoute(): void {}
}

const sample = new SampleController();

interface FakeRequest {
  path: string;
  headers: { authorization?: string };
  principal?: Principal;
}

function contextFor(handler: () => void, request: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => SampleController,
  } as unknown as ExecutionContext;
}

function requestTo(path: string, authorization?: string): FakeRequest {
  return { path, headers: authorization === undefined ? {} : { authorization } };
}

describe('AuthGuard', () => {
  const verify = vi.fn<TokenVerifier['verify']>();
  const guard = new AuthGuard(new Reflector(), { verify }, fixedClock);
  const warn = vi.spyOn(Logger.prototype, 'warn');

  beforeEach(() => {
    verify.mockReset();
    warn.mockReset().mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockClear();
  });

  describe('public routes', () => {
    it('lets anonymous callers into the public zone without verifying anything', async () => {
      const context = contextFor(sample.publicRoute, requestTo('/public/rates'));

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(verify).not.toHaveBeenCalled();
    });

    it('lets the internal health route through', async () => {
      const context = contextFor(sample.publicRoute, requestTo('/health'));

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it.each(['/api/me', '/partner/x', '/elsewhere'])(
      'refuses @Public() outside the anonymous zones (%s) and logs it',
      async (path) => {
        const context = contextFor(sample.publicRoute, requestTo(path));

        await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
        expect(warn).toHaveBeenCalledTimes(1);
      },
    );
  });

  describe('authentication', () => {
    it('rejects a missing Authorization header with 401', async () => {
      const context = contextFor(sample.customerRoute, requestTo('/api/me'));

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verify).not.toHaveBeenCalled();
    });

    it.each(['Basic dXNlcjpwYXNz', 'Bearer', 'Bearer ', 'Bearer a b', 'Token abc', 'abc.def.ghi'])(
      'rejects the malformed Authorization header %j with 401',
      async (header) => {
        const context = contextFor(sample.customerRoute, requestTo('/api/me', header));

        await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
        expect(verify).not.toHaveBeenCalled();
      },
    );

    it('answers 401 when the verifier rejects the token', async () => {
      verify.mockRejectedValue(new UnauthorizedException());
      const context = contextFor(sample.customerRoute, requestTo('/api/me', 'Bearer abc.def.ghi'));

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('answers 401 and hides the cause when the verifier fails unexpectedly', async () => {
      verify.mockRejectedValue(new Error('JWKS endpoint unreachable'));
      const context = contextFor(sample.customerRoute, requestTo('/api/me', 'Bearer abc.def.ghi'));

      const outcome = guard.canActivate(context);

      await expect(outcome).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(outcome).rejects.not.toThrow(/JWKS/);
    });

    it('accepts the Bearer scheme in any letter case and passes the bare token on', async () => {
      verify.mockResolvedValue(buildPrincipal());
      const context = contextFor(sample.customerRoute, requestTo('/api/me', 'bearer abc.def.ghi'));

      await guard.canActivate(context);

      expect(verify).toHaveBeenCalledWith('abc.def.ghi');
    });
  });

  describe('roles', () => {
    it('attaches the principal and allows a declared role', async () => {
      const principal = buildPrincipal({ roles: ['customer'] });
      verify.mockResolvedValue(principal);
      const request = requestTo('/api/me', 'Bearer abc.def.ghi');

      await expect(guard.canActivate(contextFor(sample.customerRoute, request))).resolves.toBe(
        true,
      );

      expect(request.principal).toBe(principal);
    });

    it('allows any one of several declared roles', async () => {
      verify.mockResolvedValue(buildPrincipal({ roles: ['employee'] }));
      const context = contextFor(sample.sharedRoute, requestTo('/api/x', 'Bearer abc.def.ghi'));

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it.each([['employee'], ['admin'], ['partner']] as const)(
      'rejects the %s role on a customer-only route with 403',
      async (role) => {
        verify.mockResolvedValue(buildPrincipal({ roles: [role] }));
        const context = contextFor(sample.customerRoute, requestTo('/api/x', 'Bearer abc.def.ghi'));

        await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
      },
    );

    it('rejects a principal without roles with 403', async () => {
      verify.mockResolvedValue(buildPrincipal({ roles: [] }));
      const context = contextFor(sample.customerRoute, requestTo('/api/x', 'Bearer abc.def.ghi'));

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('deny by default', () => {
    it('refuses a route without @Public() or @Roles(), warns and never verifies the token', async () => {
      const context = contextFor(sample.undeclaredRoute, requestTo('/api/x', 'Bearer abc.def.ghi'));

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Route without access declaration'),
      );
      expect(verify).not.toHaveBeenCalled();
    });

    it('keeps the partner zone closed even for a valid partner token', async () => {
      verify.mockResolvedValue(buildPrincipal({ roles: ['partner'] }));
      const context = contextFor(
        sample.customerRoute,
        requestTo('/partner/payment-requests', 'Bearer abc.def.ghi'),
      );

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
      expect(verify).not.toHaveBeenCalled();
    });

    it.each(['/internal/x', '/', '/health'])('refuses non-public routes at %s', async (path) => {
      const context = contextFor(sample.customerRoute, requestTo(path, 'Bearer abc.def.ghi'));

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('matches zones case-insensitively like Express routing', async () => {
      verify.mockResolvedValue(buildPrincipal({ roles: ['customer'] }));

      const closed = guard.canActivate(
        contextFor(sample.customerRoute, requestTo('/PARTNER/x', 'Bearer abc.def.ghi')),
      );
      const open = guard.canActivate(
        contextFor(sample.customerRoute, requestTo('/API/me', 'Bearer abc.def.ghi')),
      );

      await expect(closed).rejects.toBeInstanceOf(ForbiddenException);
      await expect(open).resolves.toBe(true);
    });
  });

  describe('step-up', () => {
    const adminRequest = () => requestTo('/api/admin/x', 'Bearer abc.def.ghi');

    it('allows a passkey authentication that is fresh', async () => {
      verify.mockResolvedValue(
        buildPrincipal({ roles: ['admin'], acr: '2', authTime: FIXED_NOW_SECONDS - 30 }),
      );

      await expect(
        guard.canActivate(contextFor(sample.adminStepUpRoute, adminRequest())),
      ).resolves.toBe(true);
    });

    it('requires step-up when the session used a password (acr 1)', async () => {
      verify.mockResolvedValue(buildPrincipal({ roles: ['admin'], acr: '1' }));

      await expect(
        guard.canActivate(contextFor(sample.adminStepUpRoute, adminRequest())),
      ).rejects.toBeInstanceOf(StepUpRequiredException);
    });

    it('requires step-up when the passkey authentication is too old', async () => {
      verify.mockResolvedValue(
        buildPrincipal({ roles: ['admin'], acr: '2', authTime: FIXED_NOW_SECONDS - 3600 }),
      );

      await expect(
        guard.canActivate(contextFor(sample.adminStepUpRoute, adminRequest())),
      ).rejects.toMatchObject({ requiredAcr: '2', maxAgeSeconds: 300 });
    });

    it('checks the role before the step-up so a wrong role is a plain 403', async () => {
      verify.mockResolvedValue(buildPrincipal({ roles: ['customer'], acr: '1' }));

      const outcome = guard.canActivate(contextFor(sample.adminStepUpRoute, adminRequest()));

      await expect(outcome).rejects.toBeInstanceOf(ForbiddenException);
      await expect(outcome).rejects.not.toBeInstanceOf(StepUpRequiredException);
    });
  });
});
