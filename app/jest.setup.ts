import { timeoutManager } from '@tanstack/react-query';
import { act, cleanup } from '@testing-library/react-native';
import type * as ReactModule from 'react';

import {
  clearTestQueryClients,
  settleTestQueryClients,
} from '@/shared/testing/renderWithProviders';

/**
 * Query garbage-collection timers (up to minutes) must not keep the Jest worker alive after the tests
 * are done, so TanStack Query's timers are unref'd. Behaviour inside a test is unchanged.
 */
interface UnrefableTimer {
  unref?: () => void;
}
function unref<TimerId>(id: TimerId): TimerId {
  (id as UnrefableTimer).unref?.();
  return id;
}
timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => unref(setTimeout(callback, delay)),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: (callback, delay) => unref(setInterval(callback, delay)),
  clearInterval: (id) => clearInterval(id),
});

/**
 * Screens are tested without a real navigator: `useRouter` returns one shared spy object,
 * `useLocalSearchParams` is controlled per test, and `Redirect` navigates through the same spy.
 */
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof ReactModule>('react');
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  };
  return {
    __esModule: true,
    useRouter: () => mockRouter,
    useLocalSearchParams: jest.fn(() => ({})),
    Redirect: ({ href }: { href: unknown }) => {
      useEffect(() => {
        mockRouter.replace(href);
      }, [href]);
      return null;
    },
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

// Let in-flight query notifications settle inside act, unmount so queries lose their observers, then
// drop the caches so no garbage-collection timer survives the test.
afterEach(async () => {
  await act(async () => {
    await settleTestQueryClients();
  });
  await cleanup();
  clearTestQueryClients();
});
