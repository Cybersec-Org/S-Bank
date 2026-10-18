import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RepositoriesProvider } from '@/shared/api/RepositoriesProvider';
import { createQueryClient } from '@/shared/api/query-client';
import { SessionProvider } from '@/shared/auth/SessionProvider';
import { ApiModeProvider } from '@/shared/config/ApiModeProvider';
import { ErrorBoundary } from '@/shared/ErrorBoundary';
import { ThemeProvider } from '@/shared/ui';

interface AppProvidersProps {
  readonly children: ReactNode;
}

/** SafeArea → theme → API mode → query cache → session → repositories → error boundary. */
export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(createQueryClient);
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ApiModeProvider>
          <QueryClientProvider client={queryClient}>
            <SessionProvider>
              <RepositoriesProvider>
                <ErrorBoundary>{children}</ErrorBoundary>
              </RepositoriesProvider>
            </SessionProvider>
          </QueryClientProvider>
        </ApiModeProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
