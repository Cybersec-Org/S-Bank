import { fireEvent, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { ApiProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import type { Account } from '../model/account';
import { HistoryScreen } from './HistoryScreen';

describe('HistoryScreen', () => {
  it('lists the operations of the first account, newest first', async () => {
    await renderWithProviders(<HistoryScreen />, { signedInAs: 'customer' });

    expect(await screen.findByText('Wynagrodzenie')).toBeOnTheScreen();
    expect(screen.getByText('Sklep Rowerowy Szprycha')).toBeOnTheScreen();
    expect(screen.getByText('Piekarnia Pod Lipą')).toBeOnTheScreen();
    expect(screen.getByText('Marek Wiśniewski')).toBeOnTheScreen();
  });

  it('has a back arrow to the dashboard', async () => {
    await renderWithProviders(<HistoryScreen />, { signedInAs: 'customer' });

    await fireEvent.press(screen.getByRole('button', { name: pl.history.backLabel }));

    expect(useRouter().back).toHaveBeenCalled();
  });

  it('filters incoming operations', async () => {
    await renderWithProviders(<HistoryScreen />, { signedInAs: 'customer' });
    await screen.findByText('Wynagrodzenie');

    await fireEvent.press(screen.getByRole('radio', { name: pl.history.typeIncoming }));

    expect(await screen.findByText('Marek Wiśniewski')).toBeOnTheScreen();
    expect(screen.queryByText('Piekarnia Pod Lipą')).not.toBeOnTheScreen();
  });

  it('filters outgoing operations', async () => {
    await renderWithProviders(<HistoryScreen />, { signedInAs: 'customer' });
    await screen.findByText('Wynagrodzenie');

    await fireEvent.press(screen.getByRole('radio', { name: pl.history.typeOutgoing }));

    expect(await screen.findByText('Piekarnia Pod Lipą')).toBeOnTheScreen();
    expect(screen.queryByText('Wynagrodzenie')).not.toBeOnTheScreen();
  });

  it('filters payments made from a QR code or a link', async () => {
    await renderWithProviders(<HistoryScreen />, { signedInAs: 'customer' });
    await screen.findByText('Wynagrodzenie');

    await fireEvent.press(screen.getByRole('radio', { name: pl.history.typePayments }));

    expect(await screen.findByText('Sklep Rowerowy Szprycha')).toBeOnTheScreen();
    expect(screen.getByText('Piekarnia Pod Lipą')).toBeOnTheScreen();
    expect(screen.queryByText('Wynagrodzenie')).not.toBeOnTheScreen();
    expect(screen.queryByText('Marek Wiśniewski')).not.toBeOnTheScreen();
  });

  it('filters by date range', async () => {
    await renderWithProviders(<HistoryScreen />, { signedInAs: 'customer' });
    await screen.findByText('Wynagrodzenie');

    await fireEvent.changeText(screen.getByLabelText(pl.history.fromLabel), '2026-10-05');
    await fireEvent.changeText(screen.getByLabelText(pl.history.toLabel), '2026-10-07');

    expect(await screen.findByText('Piekarnia Pod Lipą')).toBeOnTheScreen();
    expect(screen.getByText('Marek Wiśniewski')).toBeOnTheScreen();
    expect(screen.queryByText('Wynagrodzenie')).not.toBeOnTheScreen();
    expect(screen.queryByText('Sklep Rowerowy Szprycha')).not.toBeOnTheScreen();
  });

  it('shows the empty state when no operation matches', async () => {
    await renderWithProviders(<HistoryScreen />, { signedInAs: 'customer' });
    await screen.findByText('Wynagrodzenie');

    await fireEvent.changeText(screen.getByLabelText(pl.history.fromLabel), '2030-01-01');

    expect(await screen.findByText(pl.history.emptyTitle)).toBeOnTheScreen();
  });

  it('explains an invalid date instead of sending it', async () => {
    await renderWithProviders(<HistoryScreen />, { signedInAs: 'customer' });
    await screen.findByText('Wynagrodzenie');

    await fireEvent.changeText(screen.getByLabelText(pl.history.fromLabel), '15.10.2026');

    expect(
      screen.getByText(`${pl.common.fieldError}: ${pl.history.dateInvalid}`),
    ).toBeOnTheScreen();
  });

  it('shows a Polish error when the API fails', async () => {
    await renderWithProviders(<HistoryScreen />, {
      signedInAs: 'customer',
      mockOptions: { failWith: new ApiProblem({ status: 403 }) },
    });

    expect(await screen.findByText(pl.errors.forbidden)).toBeOnTheScreen();
  });

  it('lets a customer with several accounts switch between them', async () => {
    const savings: Account = {
      id: '00000000-0000-4000-8000-000000000102',
      name: 'Oszczędnościowy',
      iban: 'PL69123456780000000000000002',
      balanceGrosze: 3_000_000,
      dailyLimitGrosze: 200_000,
      dailyUsedGrosze: 0,
      status: 'active',
    };
    await renderWithProviders(<HistoryScreen />, {
      signedInAs: 'customer',
      repositories: (base) => ({
        ...base,
        accounts: {
          ...base.accounts,
          listAccounts: async () => [...(await base.accounts.listAccounts()), savings],
          listTransactions: (accountId, query) =>
            accountId === savings.id
              ? Promise.resolve([])
              : base.accounts.listTransactions(accountId, query),
        },
      }),
    });
    await screen.findByText('Wynagrodzenie');

    await fireEvent.press(await screen.findByRole('radio', { name: 'Oszczędnościowy' }));

    expect(await screen.findByText(pl.history.emptyTitle)).toBeOnTheScreen();
  });
});
