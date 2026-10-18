import { useRouter } from 'expo-router';

import { pl } from '@/shared/i18n/pl';
import { Button, EmptyState, Screen } from '@/shared/ui';

export function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen title={pl.common.appName}>
      <EmptyState title={pl.common.notFoundTitle} message={pl.common.notFoundMessage} />
      <Button label={pl.common.notFoundBack} onPress={() => router.replace('/')} />
    </Screen>
  );
}
