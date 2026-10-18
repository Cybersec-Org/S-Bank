import { describe, expect, it } from 'vitest';
import { buildPrincipal } from '../../../test/helpers/factories.js';
import { MeService } from './me.service.js';

describe('MeService', () => {
  const service = new MeService();

  it('summarizes the verified caller', () => {
    const summary = service.getSummary(
      buildPrincipal({ subject: 'sub-1', roles: ['employee'], acr: '2' }),
    );

    expect(summary).toEqual({ subject: 'sub-1', roles: ['employee'], acr: '2' });
  });

  it('reports a missing acr as null', () => {
    const summary = service.getSummary({ subject: 'sub-1', roles: ['customer'] });

    expect(summary.acr).toBeNull();
  });

  it('exposes only the documented fields, not internal ids', () => {
    const summary = service.getSummary(buildPrincipal({ customerId: 'internal-customer-id' }));

    expect(Object.keys(summary).sort()).toEqual(['acr', 'roles', 'subject']);
  });
});
