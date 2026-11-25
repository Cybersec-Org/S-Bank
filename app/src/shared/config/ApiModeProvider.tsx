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

/**
 * The single switch for everything that exists only for demonstration (demo sign-in, role switcher, MockBadge,
 * simulated passkey step-up). On in `mock` and in the development-only `hybrid` mode, never in `live`.
 */
export function useIsMockMode(): boolean {
  return useApiMode() !== 'live';
}
