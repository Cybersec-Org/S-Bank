import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { ApiProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { SettingsScreen } from './SettingsScreen';

describe('SettingsScreen', () => {
  it('shows the signed-in user, the biometrics switch and the passkeys', async () => {
    await renderWithProviders(<SettingsScreen />, { signedInAs: 'customer' });

    expect(await screen.findByText('Telefon (MOCK)')).toBeOnTheScreen();
    expect(screen.getByText(pl.settings.signedInAs('Anna Testowa'))).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: pl.settings.biometrics })).not.toBeChecked();
  });

  it('turns biometrics on', async () => {
    await renderWithProviders(<SettingsScreen />, { signedInAs: 'customer' });
    await screen.findByText('Telefon (MOCK)');

    await fireEvent(
      screen.getByRole('switch', { name: pl.settings.biometrics }),
      'valueChange',
      true,
    );

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: pl.settings.biometrics })).toBeChecked();
    });
  });

  it('adds and removes a passkey', async () => {
    await renderWithProviders(<SettingsScreen />, { signedInAs: 'customer' });
    await screen.findByText('Telefon (MOCK)');

    await fireEvent.press(screen.getByRole('button', { name: pl.settings.passkeyAdd }));
    expect(await screen.findByText('Klucz dostępu 2 (MOCK)')).toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole('button', { name: pl.settings.passkeyRemoveLabel('Telefon (MOCK)') }),
    );
    await waitFor(() => {
      expect(screen.queryByText('Telefon (MOCK)')).not.toBeOnTheScreen();
    });
  });

  it('shows the empty state when there are no passkeys', async () => {
    await renderWithProviders(<SettingsScreen />, {
      signedInAs: 'customer',
      mockOptions: { empty: true },
    });

    expect(await screen.findByText(pl.settings.passkeysEmptyTitle)).toBeOnTheScreen();
  });

  it('shows a Polish error when settings cannot be loaded', async () => {
    await renderWithProviders(<SettingsScreen />, {
      signedInAs: 'customer',
      mockOptions: { failWith: new ApiProblem({ status: 503 }) },
    });

    expect((await screen.findAllByText(pl.errors.server)).length).toBeGreaterThan(0);
  });

  it('signs out, drops cached data and returns to the start page', async () => {
    const { store, queryClient } = await renderWithProviders(<SettingsScreen />, {
      signedInAs: 'customer',
    });
    await screen.findByText('Telefon (MOCK)');
    const clearSpy = jest.spyOn(queryClient, 'clear');

    await fireEvent.press(screen.getByRole('button', { name: pl.nav.signOutLabel }));

    expect(store.getState().status).toBe('signedOut');
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(useRouter().replace).toHaveBeenCalledWith('/');
  });
});
