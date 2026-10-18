import { Tabs } from 'expo-router';

import { pl } from '@/shared/i18n/pl';
import { useNavigationStyle } from '@/shared/ui';

/** Bottom tabs for customers; recipients and the QR scanner are reachable from the dashboard only. */
export default function CustomerLayout() {
  const { screenOptions, tabOptions } = useNavigationStyle();
  return (
    <Tabs screenOptions={{ ...screenOptions, ...tabOptions, headerShown: false }}>
      <Tabs.Screen name="dashboard" options={{ title: pl.nav.dashboard }} />
      <Tabs.Screen name="history" options={{ title: pl.nav.history }} />
      <Tabs.Screen name="transfer" options={{ title: pl.nav.transfer }} />
      <Tabs.Screen name="settings" options={{ title: pl.nav.settings }} />
      <Tabs.Screen name="recipients" options={{ href: null, title: pl.nav.recipients }} />
      <Tabs.Screen name="scan" options={{ href: null, title: pl.nav.scan }} />
    </Tabs>
  );
}
