import { fireEvent, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { ApiProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import type { Account } from '../model/account';
import { DashboardScreen } from './DashboardScreen';

const NBSP = ' ';

describe('DashboardScreen', () => {
  it('shows the greeting, balance, limit usage and the last five operations', async () => {
    await renderWithProviders(<DashboardScreen />, { signedInAs: 'customer' });

    expect(await screen.findByText('Konto osobiste')).toBeOnTheScreen();
    expect(screen.getByText(pl.dashboard.greeting('Anna Testowa'))).toBeOnTheScreen();
    expect(screen.getByText(`12${NBSP}543,20${NBSP}zł`)).toBeOnTheScreen();
    expect(
      screen.getByText(
        pl.dashboard.limitUsage(`1${NBSP}200,00${NBSP}zł`, `5${NBSP}000,00${NBSP}zł`),
      ),
    ).toBeOnTheScreen();
    expect(await screen.findByText('Opłata za kurs')).toBeOnTheScreen();
    expect(
      screen.getAllByText(/Sklep Przykładowy|Szkoła Wzorcowa|Firma Testowa/).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Apteka')).not.toBeOnTheScreen();
  });

  it('never shows a full IBAN, only the masked one', async () => {
    await renderWithProviders(<DashboardScreen />, { signedInAs: 'customer' });

    await screen.findByText('Konto osobiste');

    expect(screen.queryByText(/PL96/)).not.toBeOnTheScreen();
    expect(screen.getAllByText(/PL•• •••• •••• •••• •••• •••• 0001/)).not.toHaveLength(0);
  });

  it('shows the mock badge in mock mode', async () => {
    await renderWithProviders(<DashboardScreen />, { signedInAs: 'customer' });
    await screen.findByText('Konto osobiste');

    expect(screen.getByLabelText(pl.common.mockBadge)).toBeOnTheScreen();
  });

  it('shows a loading state while data is on its way', async () => {
    let finish: (accounts: readonly Account[]) => void = () => undefined;
    const pending = new Promise<readonly Account[]>((resolve) => {
      finish = resolve;
    });
    await renderWithProviders(<DashboardScreen />, {
      signedInAs: 'customer',
      repositories: (base) => ({
        ...base,
        accounts: { ...base.accounts, listAccounts: () => pending },
      }),
    });

    expect(screen.getByLabelText(pl.common.loading)).toBeOnTheScreen();

    finish([]);

    expect(await screen.findByText(pl.dashboard.emptyAccountsTitle)).toBeOnTheScreen();
  });

  it('shows the empty state when the customer has no accounts', async () => {
    await renderWithProviders(<DashboardScreen />, {
      signedInAs: 'customer',
      mockOptions: { empty: true },
    });

    expect(await screen.findByText(pl.dashboard.emptyAccountsTitle)).toBeOnTheScreen();
  });

  it('shows a Polish error with a retry when the API fails', async () => {
    await renderWithProviders(<DashboardScreen />, {
      signedInAs: 'customer',
      mockOptions: { failWith: new ApiProblem({ status: 503 }) },
    });

    expect(await screen.findByText(pl.errors.server)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: pl.common.retry })).toBeOnTheScreen();
  });

  it('opens the transfer form from the shortcut', async () => {
    await renderWithProviders(<DashboardScreen />, { signedInAs: 'customer' });
    await screen.findByText('Konto osobiste');

    await fireEvent.press(screen.getByRole('button', { name: pl.dashboard.shortcutTransfer }));

    expect(useRouter().push).toHaveBeenCalledWith('/transfer');
  });

  it('offers the QR scanner, rates, ATMs and recipients shortcuts', async () => {
    await renderWithProviders(<DashboardScreen />, { signedInAs: 'customer' });
    await screen.findByText('Konto osobiste');

    expect(screen.getByRole('button', { name: pl.dashboard.shortcutScan })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: pl.dashboard.shortcutRates })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: pl.dashboard.shortcutAtms })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: pl.dashboard.shortcutRecipients })).toBeOnTheScreen();
  });
});
