import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PoliciesGuard } from './policies.guard.js';
import { Action, CaslAbilityFactory } from './casl-ability.factory.js';
import { Role, type AuthenticatedUser } from './interfaces/authenticated-user.interface.js';

describe('PoliciesGuard', () => {
  let guard: PoliciesGuard;
  let reflector: { getAllAndOverride: jest.Mock<(...args: any[]) => any> };
  let abilityFactory: CaslAbilityFactory;

  const createContext = (user?: AuthenticatedUser) => {
    const handler = {};
    const controller = {};

    return {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn<(...args: any[]) => any>(),
    };

    abilityFactory = new CaslAbilityFactory();
    guard = new PoliciesGuard(reflector as unknown as Reflector, abilityFactory);
  });

  it('allows public endpoints without a user', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === 'is_public' ? true : undefined,
    );

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('denies requests without a user by default', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(() => guard.canActivate(createContext())).toThrow(ForbiddenException);
  });

  it('denies authenticated users when the endpoint declares no abilities (A4)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const user = { id: 'client-1', role: Role.CLIENT } as AuthenticatedUser;

    expect(() => guard.canActivate(createContext(user))).toThrow(ForbiddenException);
  });

  it.each([Role.CLIENT, Role.EMPLOYEE, Role.ADMIN])(
    'lets %s read and delete own Passkeys',
    (role) => {
      reflector.getAllAndOverride.mockImplementation((key: string) =>
        key === 'check_ability'
          ? [
              { action: Action.Read, subject: 'Passkey' },
              { action: Action.Delete, subject: 'Passkey' },
            ]
          : undefined,
      );

      const user = { id: 'user-1', role } as AuthenticatedUser;

      expect(guard.canActivate(createContext(user))).toBe(true);
    },
  );

  it('allows a client to read an account', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === 'check_ability'
        ? [{ action: Action.Read, subject: 'Account' }]
        : undefined,
    );

    const user = { id: 'client-1', role: Role.CLIENT } as AuthenticatedUser;

    expect(guard.canActivate(createContext(user))).toBe(true);
  });

  it('denies an employee from transferring money', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === 'check_ability'
        ? [{ action: Action.Transfer, subject: 'Account' }]
        : undefined,
    );

    const user = { id: 'employee-1', role: Role.EMPLOYEE } as AuthenticatedUser;

    expect(() => guard.canActivate(createContext(user))).toThrow(ForbiddenException);
  });

  it('requires every declared ability to pass', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === 'check_ability'
        ? [
            { action: Action.Read, subject: 'Account' },
            { action: Action.Transfer, subject: 'Account' },
          ]
        : undefined,
    );

    const user = { id: 'employee-1', role: Role.EMPLOYEE } as AuthenticatedUser;

    expect(() => guard.canActivate(createContext(user))).toThrow(ForbiddenException);
  });
});
