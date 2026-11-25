import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PoliciesGuard } from './policies.guard.js';
import { Action, CaslAbilityFactory } from './casl-ability.factory.js';
import { Role, type AuthenticatedUser } from './interfaces/authenticated-user.interface.js';

describe('PoliciesGuard', () => {
  let guard: PoliciesGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
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
      getAllAndOverride: jest.fn(),
    };

    abilityFactory = new CaslAbilityFactory();
    guard = new PoliciesGuard(reflector as Reflector, abilityFactory);
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

  it('allows authenticated users when no abilities are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const user = { id: 'client-1', role: Role.CLIENT } as AuthenticatedUser;

    expect(guard.canActivate(createContext(user))).toBe(true);
  });

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
