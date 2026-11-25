import { isStepUpFresh, parseJwtPrincipal } from './oidc';

function toBase64Url(obj: Record<string, unknown>): string {
  return btoa(JSON.stringify(obj)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function makeJwt(payload: Record<string, unknown>): string {
  return `${toBase64Url({ alg: 'RS256', typ: 'JWT' })}.${toBase64Url(payload)}.signature`;
}

describe('parseJwtPrincipal', () => {
  it('maps Keycloak lowercase roles and acr/auth_time claims', () => {
    const token = makeJwt({
      sub: 'user-1',
      name: 'Jan Kowalski',
      acr: '2',
      auth_time: 1700000100,
      realm_access: { roles: ['default-roles-sbank', 'customer'] },
    });

    expect(parseJwtPrincipal(token)).toEqual({
      subject: 'user-1',
      displayName: 'Jan Kowalski',
      roles: ['customer'],
      acr: '2',
      authTime: 1700000100,
    });
  });

  it('normalizes uppercase API roles (EMPLOYEE, ADMIN)', () => {
    const token = makeJwt({
      sub: 'staff-1',
      email: 'admin@sbank.pl',
      acr: '2',
      realm_access: { roles: ['ADMIN'] },
    });

    expect(parseJwtPrincipal(token)).toMatchObject({
      subject: 'staff-1',
      displayName: 'admin@sbank.pl',
      roles: ['admin'],
      acr: '2',
    });
  });

  it('throws when no supported S-Bank role is present', () => {
    const token = makeJwt({
      sub: 'user-2',
      realm_access: { roles: ['offline_access'] },
    });

    expect(() => parseJwtPrincipal(token)).toThrow(/role/);
  });
});

describe('isStepUpFresh', () => {
  it('requires acr=2 and fresh auth_time within 300s', () => {
    expect(
      isStepUpFresh({ subject: 'u', displayName: 'U', roles: ['customer'], acr: '1' }, 1000),
    ).toBe(false);
    expect(
      isStepUpFresh(
        { subject: 'u', displayName: 'U', roles: ['customer'], acr: '2', authTime: 750 },
        1000,
      ),
    ).toBe(true);
    expect(
      isStepUpFresh(
        { subject: 'u', displayName: 'U', roles: ['customer'], acr: '2', authTime: 500 },
        1000,
      ),
    ).toBe(false);
  });
});
