import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
<<<<<<< HEAD
<<<<<<< HEAD
  type ExtractSubjectType,
  type InferSubjects,
  type MongoAbility,
=======
  type MongoAbility,
  type InferSubjects,
  type ExtractSubjectType,
>>>>>>> origin/passkeys-and-stepup
=======
  type MongoAbility,
  type InferSubjects,
  type ExtractSubjectType,
>>>>>>> origin/passkeys-and-stepup
} from '@casl/ability';
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

export type Subjects =
  | InferSubjects<typeof AccountSubject>
  | 'Account'
  | 'AuditLog'
  | 'Customer'
  | 'Recipient'
  | 'PaymentRequest'
  | 'SystemConfig'
  | 'all';

export type AppSubjects = Subjects;
export type AppAbility = MongoAbility<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: AuthenticatedUser): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.role === Role.ADMIN) {
      can(Action.Manage, 'all');
      cannot(Action.Transfer, 'all');
    } else if (user.role === Role.EMPLOYEE) {
      can(Action.Read, 'Account');
      can(Action.Read, AccountSubject);
      can(Action.Freeze, 'Account');
      can(Action.Freeze, AccountSubject);
      can(Action.Update, 'Account');
      can(Action.Update, AccountSubject);
      can(Action.Read, 'Customer');
      cannot(Action.Transfer, 'all');
      cannot(Action.Read, 'AuditLog');
      cannot(Action.Manage, 'SystemConfig');
    } else if (user.role === Role.CLIENT) {
      can(Action.Read, 'Account');
      can(Action.Read, 'Customer');
      can(Action.Transfer, 'Account');
      can(Action.Read, 'Recipient');
      can(Action.Create, 'Recipient');
      can(Action.Delete, 'Recipient');
      can(Action.Read, 'PaymentRequest');
      can(Action.Read, AccountSubject, { ownerId: user.id });
      can(Action.Transfer, AccountSubject, { ownerId: user.id, status: 'ACTIVE' });
      cannot(Action.Update, 'all');
      cannot(Action.Freeze, 'all');
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