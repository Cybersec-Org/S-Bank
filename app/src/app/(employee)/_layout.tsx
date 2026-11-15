import { Stack } from 'expo-router';

import { EmployeeShell } from '@/features/employee/components/EmployeeShell';
import { useNavigationStyle } from '@/shared/ui';

/** Employee panel: one shell (top bar and menu) around the customer search and the customer view. */
export default function EmployeeLayout() {
  const { screenOptions } = useNavigationStyle();
  return (
    <EmployeeShell>
      <Stack screenOptions={{ ...screenOptions, headerShown: false }} />
    </EmployeeShell>
  );
}
