import { Injectable } from '@nestjs/common';
import { AbilityBuilder, Ability, type InferSubjects, type ExtractSubjectType } from '@casl/ability';
import { type AuthenticatedUser, Role } from './interfaces/authenticated-user.interface.js';

export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  Transfer = 'transfer',
  Freeze = 'freeze',
}

export class AccountSubject {
  id!: string;
  ownerId!: string;
  status!: string;
}

export type Subjects = InferSubjects<typeof AccountSubject> | 'Account' | 'AuditLog' | 'Customer' | 'all';
export type AppSubjects = Subjects;
export type AppAbility = Ability<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: AuthenticatedUser): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(Ability);

    if (user.role === Role.ADMIN) {
      can(Action.Manage, 'all');
    } else if (user.role === Role.EMPLOYEE) {
      can(Action.Read, 'Account');
      can(Action.Read, AccountSubject);
      can(Action.Freeze, AccountSubject);
      can(Action.Update, AccountSubject);
      can(Action.Read, 'Customer');
      cannot(Action.Transfer, 'all');
    } else if (user.role === Role.CLIENT) {
      can(Action.Read, 'Account');
      can(Action.Read, AccountSubject, { ownerId: user.id });
      can(Action.Update, AccountSubject, { ownerId: user.id, status: 'ACTIVE' });
      can(Action.Transfer, AccountSubject, { ownerId: user.id, status: 'ACTIVE' });
    }

    return build({
      detectSubjectType: (item) =>
        (item instanceof AccountSubject ? AccountSubject : item) as ExtractSubjectType<Subjects>,
    });
  }

  static toAccountSubject(account: { id: string; ownerId: string; status: string }): AccountSubject {
    const subject = new AccountSubject();
    subject.id = account.id;
    subject.ownerId = account.ownerId;
    subject.status = account.status;
    return subject;
  }
}