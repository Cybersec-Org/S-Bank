import {
  AbilityBuilder,
  createMongoAbility,
  type ForcedSubject,
  type MongoAbility,
  subject,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { type AuthenticatedUser, Role } from './interfaces/authenticated-user.interface.js';

export enum Action {
  Manage = 'manage',
  Read = 'read',
  Create = 'create',
  Update = 'update',
  Transfer = 'transfer',
  Freeze = 'freeze',
}

export interface AccountSubject {
  id: string;
  ownerId: string;
  status: string;
}

export type AppSubjects =
  | 'Account'
  | (AccountSubject & ForcedSubject<'Account'>)
  | 'Transaction'
  | 'AuditLog'
  | 'all';

export type AppAbility = MongoAbility<[Action, AppSubjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: AuthenticatedUser): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    switch (user.role) {
      case Role.ADMIN:
        can(Action.Manage, 'all');
        break;

      case Role.EMPLOYEE:
        can(Action.Read, 'Account');
        can(Action.Read, 'Transaction');
        can(Action.Freeze, 'Account');
        cannot(Action.Transfer, 'Account').because(
          'Bank employees are not allowed to initiate transfers on customer accounts',
        );
        break;

      case Role.CLIENT:
      default:
        can(Action.Read, 'Account', { ownerId: user.id });
        can(Action.Update, 'Account', { ownerId: user.id });
        can(Action.Transfer, 'Account', { ownerId: user.id, status: 'ACTIVE' });
        cannot(Action.Freeze, 'Account');
        cannot(Action.Read, 'AuditLog');
        break;
    }

    return build();
  }

  static toAccountSubject(account: AccountSubject) {
    return subject('Account', {
      id: account.id,
      ownerId: account.ownerId,
      status: account.status,
    });
  }
}