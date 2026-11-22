import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { Action, CaslAbilityFactory } from '../auth/casl-ability.factory.js';
import { PoliciesGuard } from '../auth/policies.guard.js';
import { UserAuthGuard } from '../auth/user-auth.guard.js';
import { Role, type AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';

describe('AccountsController authorization', () => {
  let controller: AccountsController;
  let service: jest.Mocked<Partial<AccountsService>>;
  let policiesGuard: PoliciesGuard;
  const abilityFactory = new CaslAbilityFactory();

  beforeEach(() => {
    service = {
      findAllForUser: jest.fn().mockResolvedValue([]),
      getAuditLogs: jest.fn().mockResolvedValue([]),
      getSystemConfig: jest.fn().mockResolvedValue({}),
      createTransferDraft: jest.fn().mockResolvedValue({}),
      getCustomerDetails: jest.fn().mockResolvedValue({}),
      getRecipients: jest.fn().mockResolvedValue([]),
    };

    controller = new AccountsController(service as AccountsService);
    policiesGuard = new PoliciesGuard(
      {
        getAllAndOverride: (key: string, targets: object[]) => {
          const metadata = Reflect.getMetadata(key, targets[0]);
          return metadata ?? Reflect.getMetadata(key, targets[1]);
        },
      } as any,
      abilityFactory,
    );
  });

  const user = (role: Role, id: string): AuthenticatedUser =>
    ({ id, role }) as AuthenticatedUser;

  const authorize = (method: keyof AccountsController, currentUser?: AuthenticatedUser) => {
    const handler = AccountsController.prototype[method] as Function;
    const context = {
      getHandler: () => handler,
      getClass: () => AccountsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: currentUser }),
      }),
    } as any;

    return policiesGuard.canActivate(context);
  };

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
