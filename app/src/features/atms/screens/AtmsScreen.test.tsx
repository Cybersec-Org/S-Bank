import { fireEvent, screen } from '@testing-library/react-native';

import { ApiProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { AtmsScreen } from './AtmsScreen';

describe('AtmsScreen', () => {
  it('lists ATMs with their distances, nearest first', async () => {
    await renderWithProviders(<AtmsScreen />);

    expect(await screen.findByText('Bankomat S-Bank Rynek')).toBeOnTheScreen();
    expect(screen.getByText('350 m')).toBeOnTheScreen();
    expect(screen.getByText('1,2 km')).toBeOnTheScreen();
    const names = screen
      .getAllByText(/^Bankomat S-Bank /)
      .map((node) => node.props.children as string);
    expect(names).toEqual([
      'Bankomat S-Bank Rynek',
      'Bankomat S-Bank Dworzec',
      'Bankomat S-Bank Galeria',
      'Bankomat S-Bank Uczelnia',
    ]);
  });

  it('explains why location is needed before anything is requested', async () => {
    await renderWithProviders(<AtmsScreen />);
    await screen.findByText('Bankomat S-Bank Rynek');
    expect(screen.queryByText(pl.atms.rationaleBody)).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: pl.atms.nearestButton }));

    expect(screen.getByText(pl.atms.rationaleBody)).toBeOnTheScreen();
  });

  it('lets the user decline and keeps the list available', async () => {
    await renderWithProviders(<AtmsScreen />);
    await screen.findByText('Bankomat S-Bank Rynek');
    await fireEvent.press(screen.getByRole('button', { name: pl.atms.nearestButton }));

    await fireEvent.press(screen.getByRole('button', { name: pl.atms.rationaleDismiss }));

    expect(screen.queryByText(pl.atms.rationaleBody)).not.toBeOnTheScreen();
    expect(screen.getByText('Bankomat S-Bank Rynek')).toBeOnTheScreen();
  });

  it('says that location arrives later when the user agrees', async () => {
    await renderWithProviders(<AtmsScreen />);
    await screen.findByText('Bankomat S-Bank Rynek');
    await fireEvent.press(screen.getByRole('button', { name: pl.atms.nearestButton }));

    await fireEvent.press(screen.getByRole('button', { name: pl.atms.rationaleConfirm }));

    expect(screen.getByText(pl.atms.locationUnavailable)).toBeOnTheScreen();
  });

  it('shows the empty state', async () => {
    await renderWithProviders(<AtmsScreen />, { mockOptions: { empty: true } });

    expect(await screen.findByText(pl.atms.emptyTitle)).toBeOnTheScreen();
  });

  it('shows a Polish error', async () => {
    await renderWithProviders(<AtmsScreen />, {
      mockOptions: { failWith: new ApiProblem({ status: 500 }) },
    });

    expect(await screen.findByText(pl.errors.server)).toBeOnTheScreen();
  });
});
