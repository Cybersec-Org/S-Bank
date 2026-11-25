import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/figtree';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';

import { fonts } from './theme';

// The splash screen stays up until Figtree is ready, so text never flashes in a fallback font.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

interface FontGateProps {
  readonly children: ReactNode;
}

/** Loads Figtree; when loading fails the app still starts, with the system font. */
export function FontGate({ children }: FontGateProps) {
  const [loaded, error] = useFonts({
    [fonts.regular]: Figtree_400Regular,
    [fonts.medium]: Figtree_500Medium,
    [fonts.semibold]: Figtree_600SemiBold,
    [fonts.bold]: Figtree_700Bold,
    [fonts.extrabold]: Figtree_800ExtraBold,
  });
  const ready = loaded || error !== null;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  return ready ? <>{children}</> : null;
}
