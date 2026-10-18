import { Stack } from 'expo-router';

import { useNavigationStyle } from '@/shared/ui';

export default function TransferLayout() {
  const { screenOptions } = useNavigationStyle();
  return <Stack screenOptions={{ ...screenOptions, headerShown: false }} />;
}
