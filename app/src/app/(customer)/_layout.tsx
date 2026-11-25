import { Tabs } from 'expo-router';

import { pl } from '@/shared/i18n/pl';
import {
  EDGES_ABOVE_TAB_BAR,
  ScreenEdgesProvider,
  tabScreenOptions,
  useNavigationStyle,
} from '@/shared/ui';

/**
 * Bottom navigation of the customer: Pulpit, Przelewy, Kursy, Profil. History, recipients and the QR
 * scanner are reached from the dashboard or the profile, so they have no tab but keep the navigation bar.
 */
export default function CustomerLayout() {
  const { screenOptions, tabOptions } = useNavigationStyle();
  return (
    <Tabs
      screenOptions={{ ...screenOptions, ...tabOptions, headerShown: false }}
      screenLayout={({ children }) => (
        <ScreenEdgesProvider value={EDGES_ABOVE_TAB_BAR}>{children}</ScreenEdgesProvider>
      )}
    >
      <Tabs.Screen name="dashboard" options={tabScreenOptions(pl.nav.dashboard, 'home')} />
      <Tabs.Screen name="transfer" options={tabScreenOptions(pl.nav.transfer, 'transfer')} />
      <Tabs.Screen name="currency-rates" options={tabScreenOptions(pl.nav.ratesTab, 'rates')} />
      <Tabs.Screen name="settings" options={tabScreenOptions(pl.nav.settings, 'user')} />
      <Tabs.Screen name="history" options={{ href: null, title: pl.nav.history }} />
      <Tabs.Screen name="recipients" options={{ href: null, title: pl.nav.recipients }} />
      <Tabs.Screen name="scan" options={{ href: null, title: pl.nav.scan }} />
    </Tabs>
  );
}
