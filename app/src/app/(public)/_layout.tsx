import { Stack } from 'expo-router';

import { pl } from '@/shared/i18n/pl';
import { useNavigationStyle } from '@/shared/ui';

export default function PublicLayout() {
  const { screenOptions } = useNavigationStyle();
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="rates" options={{ title: pl.nav.rates }} />
      <Stack.Screen name="atms" options={{ title: pl.nav.atms }} />
      <Stack.Screen name="terms" options={{ title: pl.nav.terms }} />
    </Stack>
  );
}
