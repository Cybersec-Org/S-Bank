import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { Action, CaslAbilityFactory } from '../auth/casl-ability.factory.js';
import { PoliciesGuard } from '../auth/policies.guard.js';
import { UserAuthGuard } from '../auth/user-auth.guard.js';
import { Role, type AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { Reflector } from '@nestjs/core';

const reflector = {
  getAllAndOverride: jest.fn<Reflector['getAllAndOverride']>(),
};

describe('AccountsController authorization', () => {
  let controller: AccountsController;
  let service: jest.Mocked<Partial<AccountsService>>;
  let policiesGuard: PoliciesGuard;
  const abilityFactory = new CaslAbilityFactory();

  const user = (
    role: Role,
    id: string,
  ): AuthenticatedUser => ({
    id,
    role,
    ipAddress: '127.0.0.1',
    acr: '2',
  });

  const authorize = (
    handlerName: string,
    currentUser?: AuthenticatedUser,
  ): boolean => {
    const handler = controller[handlerName as keyof AccountsController];

    if (typeof handler !== 'function') {
      throw new Error(`Unknown controller handler: ${handlerName}`);
    }

  const context = {
    getHandler: () => handler,
    getClass: () => AccountsController,
    switchToHttp: () => ({
      getRequest: () => ({ user: currentUser }),
    }),
  } as any;

  return policiesGuard.canActivate(context) as boolean;
};

  beforeEach(() => {
    service = {
      findAllForUser: jest.fn<AccountsService['findAllForUser']>()
        .mockResolvedValue([]),
      getAuditLogs: jest.fn<AccountsService['getAuditLogs']>()
        .mockResolvedValue([]),
      getSystemConfig: jest.fn<AccountsService['getSystemConfig']>()
        .mockResolvedValue({
          id: 'global',
          stepUpThreshold: 1000,
          minDailyLimit: 100,
          maxDailyLimit: 50000,
          updatedAt: new Date(),
        }),
      createTransferDraft: jest.fn<AccountsService['createTransferDraft']>(),
      getCustomerDetails: jest.fn<AccountsService['getCustomerDetails']>(),
      getRecipients: jest.fn<AccountsService['getRecipients']>()
        .mockResolvedValue([]),
    };

    controller = new AccountsController(service as AccountsService);

    const reflector = {
      getAllAndOverride: jest.fn<(key: unknown, targets: unknown[]) => unknown>(),
    };

    reflector.getAllAndOverride.mockImplementation((_key: unknown, targets: unknown[]) => {
      const metadata = Reflect.getMetadata(_key as string, targets[0] as object);
      return metadata ?? Reflect.getMetadata(_key as string, targets[1] as object);
    });

    policiesGuard = new PoliciesGuard(
      reflector as unknown as Reflector,
      abilityFactory,
    );
  });
  
  it('allows a client to list accounts', async () => {
    const client = user(Role.CLIENT, 'client-1');

    expect(authorize('findAll', client)).toBe(true);
    await controller.findAll({ user: client });
    expect(service.findAllForUser).toHaveBeenCalledWith(client);
  });

  it('denies an employee from creating transfers', () => {
    expect(() =>
      authorize('createTransferDraft', user(Role.EMPLOYEE, 'employee-1')),
    ).toThrow(ForbiddenException);
  });

  it('denies an admin from creating transfers', () => {
    expect(() =>
      authorize('createTransferDraft', user(Role.ADMIN, 'admin-1')),
    ).toThrow(ForbiddenException);
  });

  it('allows an admin to access audit logs', async () => {
    const admin = user(Role.ADMIN, 'admin-1');

    expect(authorize('getAuditLogs', admin)).toBe(true);
    await controller.getAuditLogs({ user: admin });
    expect(service.getAuditLogs).toHaveBeenCalledWith(admin);
  });

  it('denies a client from accessing audit logs', () => {
    expect(() =>
      authorize('getAuditLogs', user(Role.CLIENT, 'client-1')),
    ).toThrow(ForbiddenException);
  });

  it('allows an employee to update account status', () => {
    expect(
      authorize('updateStatus', user(Role.EMPLOYEE, 'employee-1')),
    ).toBe(true);
  });

  it('restricts customers/me to clients', async () => {
    const employee = user(Role.EMPLOYEE, 'employee-1');

    await expect(
      controller.getMyProfile({ user: employee }),
    ).rejects.toThrow(ForbiddenException);

    expect(service.getCustomerDetails).not.toHaveBeenCalled();
  });

  it('allows a client to access customers/me', async () => {
    const client = user(Role.CLIENT, 'client-1');

    await controller.getMyProfile({ user: client });

    expect(service.getCustomerDetails).toHaveBeenCalledWith('client-1', client);
  });

  it('denies requests without user context', () => {
    expect(() => authorize('findAll')).toThrow(ForbiddenException);
  });
});
