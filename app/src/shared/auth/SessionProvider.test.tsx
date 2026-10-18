import { fireEvent, screen, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiModeProvider } from '@/shared/config/ApiModeProvider';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';
import { Button, Text } from '@/shared/ui';

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

    expect(screen.getByText('Anna Testowa')).toBeOnTheScreen();
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
