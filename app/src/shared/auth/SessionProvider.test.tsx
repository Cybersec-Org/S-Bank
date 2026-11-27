import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiModeProvider } from '@/shared/config/ApiModeProvider';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';
import { Button, Text } from '@/shared/ui';

import * as oidc from './oidc';
import { createSessionStore } from './session-store';
import { SessionProvider, useSession } from './SessionProvider';

function Probe() {
  const session = useSession();
  const queryClient = useQueryClient();
  return (
    <>
      <Text>{session.principal === null ? 'brak sesji' : session.principal.displayName}</Text>
      <Text>{`pamięć podręczna: ${queryClient.getQueryCache().getAll().length}`}</Text>
      <Button label="Wyloguj" onPress={session.signOut} />
    </>
  );
}

describe('useSession', () => {
  it('reports no principal when signed out', async () => {
    await renderWithProviders(<Probe />);

    expect(screen.getByText('brak sesji')).toBeOnTheScreen();
  });

  it('exposes the signed-in demo identity', async () => {
    await renderWithProviders(<Probe />, { signedInAs: 'customer' });

    expect(screen.getByText('Anna Nowak')).toBeOnTheScreen();
  });

  it('clears the query cache on sign out so no data outlives the session', async () => {
    const { queryClient, store } = await renderWithProviders(<Probe />, { signedInAs: 'customer' });
    queryClient.setQueryData(['accounts', 'list'], [{ balanceGrosze: 1 }]);

    await fireEvent.press(screen.getByRole('button', { name: 'Wyloguj' }));

    expect(store.getState().status).toBe('signedOut');
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});

function MockSignInProbe() {
  const session = useSession();
  const [result, setResult] = useState('nie próbowano');
  return (
    <>
      <Text>{result}</Text>
      <Button
        label="Spróbuj"
        onPress={() => {
          try {
            session.signInAsMock('admin');
            setResult('zalogowano');
          } catch {
            setResult('odmowa');
          }
        }}
      />
    </>
  );
}

describe('SessionProvider default store', () => {
  function renderWithDefaultStore(mode: 'mock' | 'live') {
    return render(
      <ApiModeProvider mode={mode}>
        <QueryClientProvider client={new QueryClient()}>
          <SessionProvider>
            <MockSignInProbe />
          </SessionProvider>
        </QueryClientProvider>
      </ApiModeProvider>,
    );
  }

  it('allows mock sign-in in mock mode', async () => {
    await renderWithDefaultStore('mock');

    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj' }));

    expect(screen.getByText('zalogowano')).toBeOnTheScreen();
  });

  it('refuses mock sign-in in live mode', async () => {
    await renderWithDefaultStore('live');

    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj' }));

    expect(screen.getByText('odmowa')).toBeOnTheScreen();
  });
});

function toBase64Url(obj: Record<string, unknown>): string {
  return btoa(JSON.stringify(obj)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function makeJwt(payload: Record<string, unknown>): string {
  return `${toBase64Url({ alg: 'RS256', typ: 'JWT' })}.${toBase64Url(payload)}.sig`;
}

function LiveProbe() {
  const session = useSession();
  const [result, setResult] = useState('nie próbowano');
  return (
    <>
      <Text>{result}</Text>
      <Button
        label="Hasło"
        onPress={() => {
          session.signInWithPassword().then(
            () => setResult('zalogowano'),
            (error: unknown) =>
              setResult(error instanceof oidc.OidcAuthError ? error.code : 'inny błąd'),
          );
        }}
      />
      <Button label="Wyloguj" onPress={session.signOut} />
    </>
  );
}

describe('useSession in live mode', () => {
  async function renderLive() {
    const store = createSessionStore({ mockEnabled: false });
    const queryClient = new QueryClient();
    const view = await render(
      <ApiModeProvider mode="live">
        <QueryClientProvider client={queryClient}>
          <SessionProvider store={store}>
            <LiveProbe />
          </SessionProvider>
        </QueryClientProvider>
      </ApiModeProvider>,
    );
    return { store, queryClient, view };
  }

  afterEach(() => jest.restoreAllMocks());

  it('does not keep a staff session without a Passkey (acr=1) and ends it in Keycloak', async () => {
    const tokens = {
      accessToken: makeJwt({ sub: 'emp', acr: '1', realm_access: { roles: ['employee'] } }),
      refreshToken: 'refresh-staff',
    };
    jest.spyOn(oidc, 'authenticateWithOidc').mockResolvedValue(tokens);
    const signOutSpy = jest.spyOn(oidc, 'signOutFromOidc').mockResolvedValue();
    const { store } = await renderLive();

    await fireEvent.press(screen.getByRole('button', { name: 'Hasło' }));

    expect(await screen.findByText('passkey_required')).toBeOnTheScreen();
    expect(store.getState().status).toBe('signedOut');
    expect(signOutSpy).toHaveBeenCalledWith(tokens);
  });

  it('keeps a customer session from a password sign-in (acr=1)', async () => {
    jest.spyOn(oidc, 'authenticateWithOidc').mockResolvedValue({
      accessToken: makeJwt({ sub: 'kc-1', acr: '1', realm_access: { roles: ['customer'] } }),
    });
    const { store } = await renderLive();

    await fireEvent.press(screen.getByRole('button', { name: 'Hasło' }));

    expect(await screen.findByText('zalogowano')).toBeOnTheScreen();
    expect(store.getState().status).toBe('signedIn');
  });

  it('signs out locally first, clears the query cache and ends the Keycloak session with the refresh token', async () => {
    const signOutSpy = jest.spyOn(oidc, 'signOutFromOidc').mockResolvedValue();
    const { store, queryClient } = await renderLive();
    store.setOidcSession({
      accessToken: makeJwt({ sub: 'kc-1', realm_access: { roles: ['customer'] } }),
      idToken: 'id-1',
      refreshToken: 'refresh-1',
    });
    queryClient.setQueryData(['accounts', 'list'], [{ balanceGrosze: 1 }]);

    await fireEvent.press(screen.getByRole('button', { name: 'Wyloguj' }));

    expect(store.getState().status).toBe('signedOut');
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(signOutSpy).toHaveBeenCalledWith({ refreshToken: 'refresh-1', idToken: 'id-1' });
  });

  it('drops cached data also when the session ends on its own (expired refresh, API refusal)', async () => {
    const { store, queryClient } = await renderLive();
    store.setOidcSession({
      accessToken: makeJwt({ sub: 'kc-1', realm_access: { roles: ['customer'] } }),
    });
    queryClient.setQueryData(['accounts', 'list'], [{ balanceGrosze: 1 }]);

    await act(() => store.signOut('session_expired'));

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});

function BiometricsProbe() {
  const session = useSession();
  return (
    <>
      <Text>{`status: ${session.status}`}</Text>
      <Text>{`oferta: ${String(session.biometrics.offerPending)}`}</Text>
      <Button label="Nie teraz" onPress={session.dismissBiometricsOffer} />
      <Button label="Włącz" onPress={() => void session.setBiometricsEnabled(true)} />
      <Button label="Wyloguj" onPress={session.signOut} />
    </>
  );
}

describe('biometric unlock on a phone (P-18)', () => {
  beforeEach(() => AsyncStorage.clear());

  function vault(enabled: boolean, available = true) {
    return {
      isAvailable: jest.fn(() => Promise.resolve(available)),
      isEnabled: jest.fn(() => Promise.resolve(enabled)),
      enable: jest.fn(),
      seal: jest.fn(() => Promise.resolve()),
      unlock: jest.fn(),
      clear: jest.fn(() => Promise.resolve()),
    };
  }

  async function renderPhone(v: ReturnType<typeof vault>) {
    const store = createSessionStore({ mockEnabled: false, vault: v });
    await render(
      <ApiModeProvider mode="live">
        <QueryClientProvider client={new QueryClient()}>
          <SessionProvider store={store} vault={v as never}>
            <BiometricsProbe />
          </SessionProvider>
        </QueryClientProvider>
      </ApiModeProvider>,
    );
    return store;
  }

  it('starts locked when a session is stored behind biometrics', async () => {
    await renderPhone(vault(true));

    expect(await screen.findByText('status: locked')).toBeOnTheScreen();
  });

  it('starts signed out and removes the stored session when biometrics are no longer enrolled', async () => {
    const v = vault(true, false);
    await renderPhone(v);

    await waitFor(() => expect(v.clear).toHaveBeenCalled());
    expect(screen.getByText('status: signedOut')).toBeOnTheScreen();
  });

  it('offers biometric unlock once after a customer signs in, until dismissed', async () => {
    const store = await renderPhone(vault(false));
    await act(() =>
      store.setOidcSession({
        accessToken: makeJwt({ sub: 'kc-1', realm_access: { roles: ['customer'] } }),
        refreshToken: 'refresh-1',
      }),
    );

    expect(await screen.findByText('oferta: true')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Nie teraz' }));

    expect(screen.getByText('oferta: false')).toBeOnTheScreen();
  });

  const customerTokens = () => ({
    accessToken: makeJwt({ sub: 'kc-1', realm_access: { roles: ['customer'] } }),
    refreshToken: 'refresh-1',
  });

  it('keeps offering it when enabling failed', async () => {
    const v = vault(false);
    v.enable.mockRejectedValue(new Error('keystore'));
    const store = await renderPhone(v);
    await act(() => store.setOidcSession(customerTokens()));
    expect(await screen.findByText('oferta: true')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Włącz' }));

    await waitFor(() => expect(v.enable).toHaveBeenCalled());
    expect(await screen.findByText('oferta: true')).toBeOnTheScreen();
  });

  it('offers it again at the next sign-in after a sign-out removed the stored session', async () => {
    const v = vault(false);
    v.enable.mockResolvedValue({ id: 'K' });
    const store = await renderPhone(v);
    await act(() => store.setOidcSession(customerTokens()));
    expect(await screen.findByText('oferta: true')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Włącz' }));
    await waitFor(() => expect(screen.getByText('oferta: false')).toBeOnTheScreen());

    await fireEvent.press(screen.getByRole('button', { name: 'Wyloguj' }));
    await act(() => store.setOidcSession(customerTokens()));

    expect(await screen.findByText('oferta: true')).toBeOnTheScreen();
  });

  it('never offers it to staff', async () => {
    const store = await renderPhone(vault(false));
    await act(() =>
      store.setOidcSession({
        accessToken: makeJwt({ sub: 'emp', acr: '2', realm_access: { roles: ['employee'] } }),
      }),
    );

    await waitFor(() => expect(screen.getByText('status: signedIn')).toBeOnTheScreen());
    expect(screen.getByText('oferta: false')).toBeOnTheScreen();
  });
});
