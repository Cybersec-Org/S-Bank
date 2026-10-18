import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useApiMode } from '@/shared/config/ApiModeProvider';
import { useSessionStore } from '@/shared/auth/SessionProvider';

import { createRepositories, type Repositories } from './repositories';

const RepositoriesContext = createContext<Repositories | null>(null);

interface RepositoriesProviderProps {
  readonly children: ReactNode;
  /** Tests pass a prepared set (for example mocks with zero latency). */
  readonly repositories?: Repositories;
}

export function RepositoriesProvider({ children, repositories }: RepositoriesProviderProps) {
  const mode = useApiMode();
  const sessionStore = useSessionStore();
  const resolved = useMemo(
    () =>
      repositories ??
      createRepositories({
        mode,
        getAcr: () => {
          const state = sessionStore.getState();
          return state.status === 'signedIn' ? state.principal.acr : '1';
        },
      }),
    [repositories, mode, sessionStore],
  );
  return <RepositoriesContext.Provider value={resolved}>{children}</RepositoriesContext.Provider>;
}

export function useRepositories(): Repositories {
  const repositories = useContext(RepositoriesContext);
  if (repositories === null) {
    throw new Error('useRepositories must be used inside RepositoriesProvider');
  }
  return repositories;
}
