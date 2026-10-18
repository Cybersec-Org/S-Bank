import { Tabs } from 'expo-router';

import { pl } from '@/shared/i18n/pl';
import { HeaderSignOutButton } from '@/shared/navigation/HeaderSignOutButton';
import { useNavigationStyle } from '@/shared/ui';

/** Admin area: tabs with a header so the three lists are one tap apart on wide web screens. */
export default function AdminLayout() {
  const { screenOptions, tabOptions } = useNavigationStyle();
  return (
    <Tabs
      screenOptions={{
        ...screenOptions,
        ...tabOptions,
        headerRight: () => <HeaderSignOutButton />,
      }}
    >
      <Tabs.Screen name="users" options={{ title: pl.nav.adminUsers }} />
      <Tabs.Screen name="partners" options={{ title: pl.nav.adminPartners }} />
      <Tabs.Screen name="audit" options={{ title: pl.nav.adminAudit }} />
    </Tabs>
  );
}
