
import { CaslAbilityFactory, Action, AccountSubject } from './casl-ability.factory.js';
import { Role } from './interfaces/authenticated-user.interface.js';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface.js';

describe('CaslAbilityFactory', () => {
  const factory = new CaslAbilityFactory();

  const client: AuthenticatedUser = {
    id: 'client-1',
    role: Role.CLIENT,
  } as AuthenticatedUser;

  const employee: AuthenticatedUser = {
    id: 'employee-1',
    role: Role.EMPLOYEE,
  } as AuthenticatedUser;

  const admin: AuthenticatedUser = {
    id: 'admin-1',
    role: Role.ADMIN,
  } as AuthenticatedUser;

  it('allows a client to read their own account', () => {
    const ability = factory.createForUser(client);
    const account = CaslAbilityFactory.toAccountSubject({
      id: 'account-1',
      ownerId: 'client-1',
      status: 'ACTIVE',
    });

    expect(ability.can(Action.Read, account)).toBe(true);
  });

  it('denies a client access to another client account', () => {
    const ability = factory.createForUser(client);
    const account = CaslAbilityFactory.toAccountSubject({
      id: 'account-2',
      ownerId: 'client-2',
      status: 'ACTIVE',
    });

    expect(ability.can(Action.Read, account)).toBe(false);
  });

  it('denies a client transfers from another client account', () => {
    const ability = factory.createForUser(client);
    const account = CaslAbilityFactory.toAccountSubject({
      id: 'account-2',
      ownerId: 'client-2',
      status: 'ACTIVE',
    });

    expect(ability.can(Action.Transfer, account)).toBe(false);
  });

  it('denies a client transfers from a frozen account', () => {
    const ability = factory.createForUser(client);
    const account = CaslAbilityFactory.toAccountSubject({
      id: 'account-1',
      ownerId: 'client-1',
      status: 'FROZEN',
    });

    expect(ability.can(Action.Transfer, account)).toBe(false);
  });

  it('denies employees transfers', () => {
    const ability = factory.createForUser(employee);

    expect(ability.can(Action.Transfer, 'Account')).toBe(false);
  });

  it('allows employees to read accounts', () => {
    const ability = factory.createForUser(employee);

    expect(ability.can(Action.Read, 'Account')).toBe(true);
  });

  it('allows admins to manage system configuration', () => {
    const ability = factory.createForUser(admin);

    expect(ability.can(Action.Manage, 'SystemConfig')).toBe(true);
  });

  it('denies admins transfers', () => {
    const ability = factory.createForUser(admin);

    expect(ability.can(Action.Transfer, 'Account')).toBe(false);
  });
});

