import { fireEvent, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { StartScreen } from './StartScreen';

describe('StartScreen', () => {
  describe('in mock mode', () => {
    it('offers the three demo roles and the public links', async () => {
      await renderWithProviders(<StartScreen />, { apiMode: 'mock' });

      expect(screen.getByRole('button', { name: pl.start.mockCustomer })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: pl.start.mockEmployee })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: pl.start.mockAdmin })).toBeOnTheScreen();
      expect(screen.getByRole('link', { name: pl.start.linkRates })).toBeOnTheScreen();
      expect(screen.getByRole('link', { name: pl.start.linkAtms })).toBeOnTheScreen();
      expect(screen.getByRole('link', { name: pl.start.linkTerms })).toBeOnTheScreen();
    });

    it('does not offer the real login button', async () => {
      await renderWithProviders(<StartScreen />, { apiMode: 'mock' });

      expect(screen.queryByRole('button', { name: pl.start.loginLive })).not.toBeOnTheScreen();
    });

    it('signs in as the chosen role', async () => {
      const { store } = await renderWithProviders(<StartScreen />, { apiMode: 'mock' });

      await fireEvent.press(screen.getByRole('button', { name: pl.start.mockEmployee }));

      const state = store.getState();
      expect(state.status === 'signedIn' && state.principal.roles).toEqual(['employee']);
    });

    it('redirects a signed-in customer to the dashboard', async () => {
      await renderWithProviders(<StartScreen />, { apiMode: 'mock', signedInAs: 'customer' });

      expect(useRouter().replace).toHaveBeenCalledWith('/dashboard');
    });

    it('opens the public pages from the links', async () => {
      await renderWithProviders(<StartScreen />, { apiMode: 'mock' });

      await fireEvent.press(screen.getByRole('link', { name: pl.start.linkRates }));

      expect(useRouter().push).toHaveBeenCalledWith('/rates');
    });
  });

  describe('in live mode', () => {
    it('does not render the mock role switcher at all', async () => {
      await renderWithProviders(<StartScreen />, { apiMode: 'live' });

      expect(screen.queryByText(pl.start.mockHeading)).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: pl.start.mockCustomer })).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: pl.start.mockEmployee })).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: pl.start.mockAdmin })).not.toBeOnTheScreen();
    });

    it('shows the OIDC login button and no mock badge', async () => {
      await renderWithProviders(<StartScreen />, { apiMode: 'live' });

      expect(screen.getByRole('button', { name: pl.start.loginLive })).toBeOnTheScreen();
      expect(screen.queryByLabelText(pl.common.mockBadge)).not.toBeOnTheScreen();
    });

    it('explains that browser login arrives later instead of faking a session', async () => {
      const { store } = await renderWithProviders(<StartScreen />, { apiMode: 'live' });

      await fireEvent.press(screen.getByRole('button', { name: pl.start.loginLive }));

      expect(screen.getByText(pl.start.loginLiveUnavailable)).toBeOnTheScreen();
      expect(store.getState().status).toBe('signedOut');
    });
  });
});
