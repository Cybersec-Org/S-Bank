import { useRouter } from 'expo-router';

import { useSession } from '@/shared/auth/SessionProvider';
import { pl } from '@/shared/i18n/pl';
import { Button } from '@/shared/ui';

/** Sign-out entry in the employee and admin headers (customers use the settings screen). */
export function HeaderSignOutButton() {
  const router = useRouter();
  const session = useSession();
  return (
    <Button
      label={pl.nav.signOut}
      variant="secondary"
      accessibilityLabel={pl.nav.signOutLabel}
      onPress={() => {
        session.signOut();
        router.replace('/');
      }}
    />
  );
}
