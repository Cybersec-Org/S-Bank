import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useSession } from '@/shared/auth/SessionProvider';
import { AppProviders } from '@/shared/AppProviders';
import { useNavigationStyle } from '@/shared/ui';

/**
 * Role groups are shown only to matching roles. These guards are UI convenience: the API enforces
 * access on every request and never relies on what the app chooses to display.
 */
function RootNavigator() {
  const session = useSession();
  const { screenOptions } = useNavigationStyle();
  return (
    <Stack screenOptions={{ ...screenOptions, headerShown: false }}>
      <Stack.Screen name="(public)" />
      <Stack.Protected guard={session.hasRole('customer')}>
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="pay/[requestId]" />
      </Stack.Protected>
      <Stack.Protected guard={session.hasRole('employee')}>
        <Stack.Screen name="(employee)" />
      </Stack.Protected>
      <Stack.Protected guard={session.hasRole('admin')}>
        <Stack.Screen name="(admin)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="auto" />
      <RootNavigator />
    </AppProviders>
  );
}
