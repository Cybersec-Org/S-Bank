import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { RepositoriesProvider } from '@/shared/api/RepositoriesProvider';
import { createMockRepositories, type Repositories } from '@/shared/api/repositories';
import { SessionProvider } from '@/shared/auth/SessionProvider';
import { createSessionStore, type SessionStore } from '@/shared/auth/session-store';
import type { Role } from '@/shared/auth/roles';
import { ApiModeProvider } from '@/shared/config/ApiModeProvider';
import type { ApiMode } from '@/shared/config/env';
import { ThemeProvider } from '@/shared/ui';

import type { MockOptions } from '@/shared/api/mock/mock-runner';

interface RenderOptions {
  readonly apiMode?: ApiMode;
  /** Signs in as this demo identity before rendering. */
  readonly signedInAs?: Role;
  /** Replaces whole repositories, for example with an error-throwing stub. */
  readonly repositories?: (base: Repositories) => Repositories;
  readonly mockOptions?: Partial<MockOptions>;
  /** Runs against the final repositories before the first render, to seed a draft or a request. */
  readonly arrange?: (repositories: Repositories) => Promise<void>;
}

const NO_LATENCY: Partial<MockOptions> = { latencyMs: 0 };

const createdQueryClients: QueryClient[] = [];

const MAX_SETTLE_TICKS = 50;

function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Waits until no query or mutation of the test clients is still running, then lets React flush. */
export async function settleTestQueryClients(): Promise<void> {
  for (let tick = 0; tick < MAX_SETTLE_TICKS; tick += 1) {
    const idle = createdQueryClients.every(
      (client) => client.isFetching() === 0 && client.isMutating() === 0,
    );
    if (idle) {
      break;
    }
    await nextTick();
  }
  await nextTick();
}

/** Clears every cache created by `renderWithProviders`, which also cancels its garbage-collection timers. */
export function clearTestQueryClients(): void {
  createdQueryClients.splice(0).forEach((client) => client.clear());
}

/** Renders a screen with the same provider stack as the app, using fast in-memory mock repositories. */
export async function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  const apiMode = options.apiMode ?? 'mock';
  const store: SessionStore = createSessionStore({ mockEnabled: true });
  if (options.signedInAs !== undefined) {
    store.signInAsMock(options.signedInAs);
  }
  const base = createMockRepositories(
    () => {
      const state = store.getState();
      return state.status === 'signedIn' ? state.principal.acr : '1';
    },
    { ...NO_LATENCY, ...options.mockOptions },
  );
  const repositories = options.repositories === undefined ? base : options.repositories(base);
  await options.arrange?.(repositories);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { gcTime: 0 } },
  });
  createdQueryClients.push(queryClient);

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <ThemeProvider scheme="light">
        <ApiModeProvider mode={apiMode}>
          <QueryClientProvider client={queryClient}>
            <SessionProvider store={store}>
              <RepositoriesProvider repositories={repositories}>{children}</RepositoriesProvider>
            </SessionProvider>
          </QueryClientProvider>
        </ApiModeProvider>
      </ThemeProvider>
    );
  }

  const result = await render(ui, { wrapper: Wrapper });
  return { ...result, store, queryClient, repositories };
}
