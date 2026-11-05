import { fireEvent, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { ApiProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { DEMO_PAYMENT_REQUEST_ID } from '@/features/payments';

import type { Account } from '../model/account';
import { DashboardScreen } from './DashboardScreen';

const NBSP = ' ';

describe('DashboardScreen', () => {
  it('shows the greeting, the balance card and the four operations of the design', async () => {
    await renderWithProviders(<DashboardScreen />, { signedInAs: 'customer' });

    expect(await screen.findByText('Rachunek osobisty')).toBeOnTheScreen();
    expect(screen.getByText(pl.dashboard.greeting)).toBeOnTheScreen();
    expect(screen.getByText('Anna Nowak')).toBeOnTheScreen();
    expect(screen.getByText(`4${NBSP}280,15${NBSP}zł`)).toBeOnTheScreen();
    expect(screen.getByText(pl.dashboard.limitToday(`5${NBSP}000${NBSP}zł`))).toBeOnTheScreen();

    expect(await screen.findByText('Wynagrodzenie')).toBeOnTheScreen();
    expect(screen.getByText('Przelew przychodzący · 8 paź')).toBeOnTheScreen();
    expect(screen.getByText(`+5${NBSP}400,00${NBSP}zł`)).toBeOnTheScreen();
    expect(screen.getByText('Piekarnia Pod Lipą')).toBeOnTheScreen();
    expect(screen.getByText('Płatność z kodu QR · 7 paź')).toBeOnTheScreen();
    expect(screen.getByText(`\u221218,40${NBSP}zł`)).toBeOnTheScreen();
    expect(screen.getByText('Marek Wiśniewski')).toBeOnTheScreen();
    expect(screen.getByText(`+120,00${NBSP}zł`)).toBeOnTheScreen();
    expect(screen.getByText('Sklep Rowerowy Szprycha')).toBeOnTheScreen();
    expect(screen.getByText('Płatność z linku · 2 paź')).toBeOnTheScreen();
    expect(screen.getByText(`\u2212249,00${NBSP}zł`)).toBeOnTheScreen();
  });

  it('shows the balance in euro at the NBP rate under the balance', async () => {
    await renderWithProviders(<DashboardScreen />, { signedInAs: 'customer' });

    expect(
      await screen.findByText(pl.dashboard.approxForeign(`977,45${NBSP}EUR`)),
    ).toBeOnTheScreen();
  });

  it('never shows a full IBAN, only the masked one', async () => {
    await renderWithProviders(<DashboardScreen />, { signedInAs: 'customer' });

    await screen.findByText('Rachunek osobisty');

    expect(screen.queryByText(/PL33/)).not.toBeOnTheScreen();
    expect(screen.getByText('•••• 4821')).toBeOnTheScreen();
  });

  it('shows the mock badge in mock mode', async () => {
    await renderWithProviders(<DashboardScreen />, { signedInAs: 'customer' });
    await screen.findByText('Rachunek osobisty');

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
    await screen.findByText('Rachunek osobisty');

    await fireEvent.press(screen.getByRole('button', { name: pl.dashboard.shortcutTransfer }));

    expect(useRouter().push).toHaveBeenCalledWith('/transfer');
  });

  it('offers the four shortcuts of the design', async () => {
    await renderWithProviders(<DashboardScreen />, { signedInAs: 'customer' });
    await screen.findByText('Rachunek osobisty');

    expect(screen.getByRole('button', { name: pl.dashboard.shortcutTransfer })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: pl.dashboard.shortcutScan })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: pl.dashboard.shortcutRates })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: pl.dashboard.shortcutAtms })).toBeOnTheScreen();
  });

  it('opens the demo payment request from "Skanuj QR" in mock mode, passing only an id', async () => {
    await renderWithProviders(<DashboardScreen />, { signedInAs: 'customer' });
    await screen.findByText('Rachunek osobisty');

    await fireEvent.press(screen.getByRole('button', { name: pl.dashboard.shortcutScan }));

    expect(useRouter().push).toHaveBeenCalledWith({
      pathname: '/pay/[requestId]',
      params: { requestId: DEMO_PAYMENT_REQUEST_ID, source: 'qr' },
    });
  });

  it('opens the scanner screen instead in live mode', async () => {
    await renderWithProviders(<DashboardScreen />, { signedInAs: 'customer', apiMode: 'live' });

    await fireEvent.press(await screen.findByRole('button', { name: pl.dashboard.shortcutScan }));

    expect(useRouter().push).toHaveBeenCalledWith('/scan');
  });

  it('links to the whole history', async () => {
    await renderWithProviders(<DashboardScreen />, { signedInAs: 'customer' });
    await screen.findByText('Rachunek osobisty');

    await fireEvent.press(screen.getByRole('link', { name: pl.dashboard.allHistory }));

    expect(useRouter().push).toHaveBeenCalledWith('/history');
  });

  it('locks the app: ends the session and returns to the login screen', async () => {
    const { store } = await renderWithProviders(<DashboardScreen />, { signedInAs: 'customer' });
    await screen.findByText('Rachunek osobisty');

    await fireEvent.press(screen.getByRole('button', { name: pl.dashboard.lockApp }));

    expect(store.getState().status).toBe('signedOut');
    expect(useRouter().replace).toHaveBeenCalledWith('/');
  });
});
