import { Stack } from 'expo-router';

import { pl } from '@/shared/i18n/pl';
import { HeaderSignOutButton } from '@/shared/navigation/HeaderSignOutButton';
import { useNavigationStyle } from '@/shared/ui';

export default function EmployeeLayout() {
  const { screenOptions } = useNavigationStyle();
  return (
    <Stack screenOptions={{ ...screenOptions, headerRight: () => <HeaderSignOutButton /> }}>
      <Stack.Screen name="customers/index" options={{ title: pl.nav.employeeCustomers }} />
      <Stack.Screen
        name="customers/[customerId]"
        options={{ title: pl.nav.employeeCustomerDetails }}
      />
    </Stack>
  );
}
