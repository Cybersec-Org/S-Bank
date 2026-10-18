import {
  AbilityBuilder,
  createMongoAbility,
  type ForcedSubject,
  type MongoAbility,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import type { Principal } from '../auth/principal.js';

export type AppAction = 'read' | 'create' | 'update';

/** Resource instances are tagged with CASL's `subject('Account', { ownerId })` before checking. */
export type AccountSubject = ForcedSubject<'Account'> & { readonly ownerId: string };

export type PaymentRequestSubject = ForcedSubject<'PaymentRequest'> & {
  readonly partnerId: string;
};

export type AppSubject =
  'Account' | AccountSubject | 'AuditLog' | 'PaymentRequest' | PaymentRequestSubject;

export type AppAbility = MongoAbility<[AppAction, AppSubject]>;

/** Account fields an employee may change: the daily limit and the blocked/active status. */
export const EMPLOYEE_EDITABLE_ACCOUNT_FIELDS = ['dailyLimitGrosze', 'status'] as const;

/**
 * Builds the CASL rules for a verified caller. Everything not granted here is denied.
 * Rules that depend on an id (customer, partner) are emitted only when the id is known.
 */
@Injectable()
export class AbilityFactory {
  createFor(principal: Principal): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (principal.roles.includes('customer') && principal.customerId) {
      can('read', 'Account', { ownerId: principal.customerId });
    }
    if (principal.roles.includes('employee')) {
      can('read', 'Account');
      can('update', 'Account', [...EMPLOYEE_EDITABLE_ACCOUNT_FIELDS]);
    }
    if (principal.roles.includes('admin')) {
      can('read', 'AuditLog');
    }
    if (principal.roles.includes('partner') && principal.partnerId) {
      can(['create', 'read'], 'PaymentRequest', { partnerId: principal.partnerId });
    }

    return build();
  }
}
