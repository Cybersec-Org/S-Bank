import { fireEvent, screen, render } from '@testing-library/react-native';
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
});
