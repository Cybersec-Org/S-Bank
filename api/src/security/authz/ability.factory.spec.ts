import { subject } from '@casl/ability';
import { describe, expect, it } from 'vitest';
import { buildPrincipal } from '../../../test/helpers/factories.js';
import { AbilityFactory } from './ability.factory.js';

const factory = new AbilityFactory();
const OWN_CUSTOMER_ID = 'customer-own';
const OTHER_CUSTOMER_ID = 'customer-other';

describe('AbilityFactory', () => {
  describe('customer', () => {
    const ability = factory.createFor(
      buildPrincipal({ roles: ['customer'], customerId: OWN_CUSTOMER_ID }),
    );

    it('reads only own accounts', () => {
      expect(ability.can('read', subject('Account', { ownerId: OWN_CUSTOMER_ID }))).toBe(true);
      expect(ability.can('read', subject('Account', { ownerId: OTHER_CUSTOMER_ID }))).toBe(false);
    });

    it('cannot change accounts, read the audit log or touch payment requests', () => {
      expect(ability.can('update', subject('Account', { ownerId: OWN_CUSTOMER_ID }))).toBe(false);
      expect(ability.can('read', 'AuditLog')).toBe(false);
      expect(ability.can('read', subject('PaymentRequest', { partnerId: 'partner-1' }))).toBe(
        false,
      );
    });

    it('gets no account access when the customer id is unknown', () => {
      const unresolved = factory.createFor(buildPrincipal({ roles: ['customer'] }));

      expect(unresolved.can('read', subject('Account', { ownerId: OWN_CUSTOMER_ID }))).toBe(false);
    });
  });

  describe('employee', () => {
    const ability = factory.createFor(buildPrincipal({ roles: ['employee'] }));

    it('reads any account', () => {
      expect(ability.can('read', subject('Account', { ownerId: OTHER_CUSTOMER_ID }))).toBe(true);
    });

    it('updates only the daily limit and the status of an account', () => {
      expect(ability.can('update', 'Account', 'dailyLimitGrosze')).toBe(true);
      expect(ability.can('update', 'Account', 'status')).toBe(true);
      expect(ability.can('update', 'Account', 'balanceGrosze')).toBe(false);
      expect(ability.can('update', 'Account', 'iban')).toBe(false);
    });

    it('cannot read the audit log or create anything', () => {
      expect(ability.can('read', 'AuditLog')).toBe(false);
      expect(ability.can('create', 'Account')).toBe(false);
    });
  });

  describe('admin', () => {
    const ability = factory.createFor(buildPrincipal({ roles: ['admin'] }));

    it('reads the audit log', () => {
      expect(ability.can('read', 'AuditLog')).toBe(true);
    });

    it('cannot write the audit log, read accounts or move money', () => {
      expect(ability.can('update', 'AuditLog')).toBe(false);
      expect(ability.can('create', 'AuditLog')).toBe(false);
      expect(ability.can('read', subject('Account', { ownerId: OWN_CUSTOMER_ID }))).toBe(false);
      expect(ability.can('update', 'Account', 'balanceGrosze')).toBe(false);
    });
  });

  describe('partner', () => {
    const ability = factory.createFor(
      buildPrincipal({ roles: ['partner'], partnerId: 'partner-1' }),
    );

    it('creates and reads only its own payment requests', () => {
      expect(ability.can('create', subject('PaymentRequest', { partnerId: 'partner-1' }))).toBe(
        true,
      );
      expect(ability.can('read', subject('PaymentRequest', { partnerId: 'partner-1' }))).toBe(true);
      expect(ability.can('read', subject('PaymentRequest', { partnerId: 'partner-2' }))).toBe(
        false,
      );
    });

    it('cannot read accounts or the audit log', () => {
      expect(ability.can('read', subject('Account', { ownerId: OWN_CUSTOMER_ID }))).toBe(false);
      expect(ability.can('read', 'AuditLog')).toBe(false);
    });
  });

  it('denies everything without roles', () => {
    const ability = factory.createFor(buildPrincipal({ roles: [], customerId: OWN_CUSTOMER_ID }));

    expect(ability.rules).toHaveLength(0);
  });

  it('combines the rules of several roles', () => {
    const ability = factory.createFor(buildPrincipal({ roles: ['employee', 'admin'] }));

    expect(ability.can('read', 'AuditLog')).toBe(true);
    expect(ability.can('update', 'Account', 'status')).toBe(true);
  });
});
