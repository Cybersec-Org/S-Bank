import { fireEvent, screen } from '@testing-library/react-native';

import { ApiProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { HistoryScreen } from './HistoryScreen';

describe('HistoryScreen', () => {
  it('lists the operations of the first account, newest first', async () => {
    await renderWithProviders(<HistoryScreen />, { signedInAs: 'customer' });

    expect(await screen.findByText('Opłata za kurs')).toBeOnTheScreen();
    expect(screen.getByText('Apteka')).toBeOnTheScreen();
  });

  it('filters by operation kind', async () => {
    await renderWithProviders(<HistoryScreen />, { signedInAs: 'customer' });
    await screen.findByText('Opłata za kurs');

    await fireEvent.press(screen.getByRole('radio', { name: pl.history.typeIncoming }));

    expect(await screen.findByText('Wynagrodzenie za wrzesień')).toBeOnTheScreen();
    expect(screen.queryByText('Opłata za kurs')).not.toBeOnTheScreen();
  });

  it('filters by date range', async () => {
    await renderWithProviders(<HistoryScreen />, { signedInAs: 'customer' });
    await screen.findByText('Opłata za kurs');

    await fireEvent.changeText(screen.getByLabelText(pl.history.fromLabel), '2026-10-13');
    await fireEvent.changeText(screen.getByLabelText(pl.history.toLabel), '2026-10-14');

    expect(await screen.findByText('Zakupy spożywcze')).toBeOnTheScreen();
    expect(screen.queryByText('Czynsz za październik')).not.toBeOnTheScreen();
    expect(screen.queryByText('Opłata za kurs')).not.toBeOnTheScreen();
  });

  it('shows the empty state when no operation matches', async () => {
    await renderWithProviders(<HistoryScreen />, { signedInAs: 'customer' });
    await screen.findByText('Opłata za kurs');

    await fireEvent.changeText(screen.getByLabelText(pl.history.fromLabel), '2030-01-01');

    expect(await screen.findByText(pl.history.emptyTitle)).toBeOnTheScreen();
  });

  it('explains an invalid date instead of sending it', async () => {
    await renderWithProviders(<HistoryScreen />, { signedInAs: 'customer' });
    await screen.findByText('Opłata za kurs');

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

  it('lets the customer switch accounts', async () => {
    await renderWithProviders(<HistoryScreen />, { signedInAs: 'customer' });
    await screen.findByText('Opłata za kurs');

    await fireEvent.press(screen.getByRole('radio', { name: 'Konto oszczędnościowe' }));

    expect(await screen.findByText(pl.history.emptyTitle)).toBeOnTheScreen();
  });
});
