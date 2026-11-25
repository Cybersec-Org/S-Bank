import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import * as oidc from '@/shared/auth/oidc';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { StartScreen } from './StartScreen';

function toBase64Url(obj: Record<string, unknown>): string {
  return btoa(JSON.stringify(obj)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function makeJwt(payload: Record<string, unknown>): string {
  return `${toBase64Url({ alg: 'RS256', typ: 'JWT' })}.${toBase64Url(payload)}.sig`;
}

describe('StartScreen', () => {
  describe('in mock mode', () => {
    it('shows the logo, the tagline, both login buttons, the info panel and the links', async () => {
      await renderWithProviders(<StartScreen />, { apiMode: 'mock' });

      expect(screen.getByLabelText(pl.start.logoLabel)).toBeOnTheScreen();
      expect(screen.getByText(pl.common.appName)).toBeOnTheScreen();
      expect(screen.getByLabelText(pl.start.taglineLabel)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: pl.start.loginPasskey })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: pl.start.loginPassword })).toBeOnTheScreen();
      expect(screen.getByText(pl.start.loginInfo)).toBeOnTheScreen();
      expect(screen.getByText(pl.start.sessionDivider)).toBeOnTheScreen();
      expect(screen.getByRole('link', { name: pl.start.linkRates })).toBeOnTheScreen();
      expect(screen.getByRole('link', { name: pl.start.linkTerms })).toBeOnTheScreen();
    });

    it('keeps biometric unlock inactive in this stage', async () => {
      await renderWithProviders(<StartScreen />, { apiMode: 'mock' });

      expect(screen.getByRole('button', { name: pl.start.unlockBiometrics })).toBeDisabled();
    });

    it.each([pl.start.loginPasskey, pl.start.loginPassword])(
      'signs in as the demo customer with "%s"',
      async (label) => {
        const { store } = await renderWithProviders(<StartScreen />, { apiMode: 'mock' });

        await fireEvent.press(screen.getByRole('button', { name: label }));

        const state = store.getState();
        expect(state.status === 'signedIn' && state.principal.roles).toEqual(['customer']);
      },
    );

    it('hides the staff sign-in until the developer toggle is pressed', async () => {
      const { store } = await renderWithProviders(<StartScreen />, { apiMode: 'mock' });
      expect(screen.queryByRole('button', { name: pl.start.devEmployee })).not.toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: pl.start.devToggle }));
      await fireEvent.press(screen.getByRole('button', { name: pl.start.devEmployee }));

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
    it('does not offer the developer sign-in at all', async () => {
      await renderWithProviders(<StartScreen />, { apiMode: 'live' });

      expect(screen.queryByRole('button', { name: pl.start.devToggle })).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: pl.start.devEmployee })).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: pl.start.devAdmin })).not.toBeOnTheScreen();
    });

    it('shows the login buttons and no mock badge', async () => {
      await renderWithProviders(<StartScreen />, { apiMode: 'live' });

      expect(screen.getByRole('button', { name: pl.start.loginPasskey })).toBeOnTheScreen();
      expect(screen.queryByLabelText(pl.common.mockBadge)).not.toBeOnTheScreen();
    });

    it('starts OIDC PKCE with acr_values=2 on passkey sign-in and stores the verified session', async () => {
      const spy = jest.spyOn(oidc, 'authenticateWithOidc').mockResolvedValue({
        accessToken: makeJwt({
          sub: 'kc-1',
          name: 'Jan Kowalski',
          acr: '2',
          auth_time: Math.floor(Date.now() / 1000),
          realm_access: { roles: ['customer'] },
        }),
      });
      const { store } = await renderWithProviders(<StartScreen />, { apiMode: 'live' });

      await fireEvent.press(screen.getByRole('button', { name: pl.start.loginPasskey }));

      await waitFor(() => {
        expect(store.getState().status).toBe('signedIn');
      });
      expect(spy).toHaveBeenCalledWith({ acrValues: '2' });
      spy.mockRestore();
    });

    it('shows access-denied message when staff tries password login without passkey', async () => {
      const spy = jest
        .spyOn(oidc, 'authenticateWithOidc')
        .mockRejectedValue(new oidc.OidcAuthError('access_denied', 'Access denied'));
      const { store } = await renderWithProviders(<StartScreen />, { apiMode: 'live' });

      await fireEvent.press(screen.getByRole('button', { name: pl.start.loginPassword }));

      expect(await screen.findByText(pl.start.loginAccessDenied)).toBeOnTheScreen();
      expect(store.getState().status).toBe('signedOut');
      spy.mockRestore();
    });
  });
});
