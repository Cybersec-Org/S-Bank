import { screen } from '@testing-library/react-native';

import { ApiProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { AuditScreen } from './AuditScreen';
import { PartnersScreen } from './PartnersScreen';
import { UsersScreen } from './UsersScreen';

describe('UsersScreen', () => {
  it('lists users with their roles', async () => {
    await renderWithProviders(<UsersScreen />, { signedInAs: 'admin' });

    expect(await screen.findByText('Anna Testowa')).toBeOnTheScreen();
    expect(screen.getByText(pl.roles.employee)).toBeOnTheScreen();
  });

  it('shows the empty state', async () => {
    await renderWithProviders(<UsersScreen />, {
      signedInAs: 'admin',
      mockOptions: { empty: true },
    });

    expect(await screen.findByText(pl.admin.usersEmptyTitle)).toBeOnTheScreen();
  });
});

describe('PartnersScreen', () => {
  it('lists partners with their status', async () => {
    await renderWithProviders(<PartnersScreen />, { signedInAs: 'admin' });

    expect(await screen.findByText('Sklep Demonstracyjny')).toBeOnTheScreen();
    expect(screen.getByText(pl.admin.partnerSuspended)).toBeOnTheScreen();
  });

  it('shows a Polish error', async () => {
    await renderWithProviders(<PartnersScreen />, {
      signedInAs: 'admin',
      mockOptions: { failWith: new ApiProblem({ status: 500 }) },
    });

    expect(await screen.findByText(pl.errors.server)).toBeOnTheScreen();
  });
});

describe('AuditScreen', () => {
  it('shows the read-only notice and offers no way to change entries', async () => {
    await renderWithProviders(<AuditScreen />, { signedInAs: 'admin' });

    expect(await screen.findByText(pl.admin.auditActions.transferConfirmed)).toBeOnTheScreen();
    expect(screen.getByText(pl.admin.auditReadOnly)).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('shows the empty state', async () => {
    await renderWithProviders(<AuditScreen />, {
      signedInAs: 'admin',
      mockOptions: { empty: true },
    });

    expect(await screen.findByText(pl.admin.auditEmptyTitle)).toBeOnTheScreen();
  });
});
