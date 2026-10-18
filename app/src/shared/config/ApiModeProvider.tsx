import { createContext, useContext, type ReactNode } from 'react';

import { env, type ApiMode } from './env';

const ApiModeContext = createContext<ApiMode>(env.apiMode);

interface ApiModeProviderProps {
  readonly children: ReactNode;
  /** Overrides the build-time mode; only tests pass it. */
  readonly mode?: ApiMode;
}

export function ApiModeProvider({ children, mode = env.apiMode }: ApiModeProviderProps) {
  return <ApiModeContext.Provider value={mode}>{children}</ApiModeContext.Provider>;
}

export function useApiMode(): ApiMode {
  return useContext(ApiModeContext);
}

/** The single switch for everything that exists only for demonstration (role switcher, MockBadge). */
export function useIsMockMode(): boolean {
  return useApiMode() === 'mock';
}
